const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/tests/start - Start a new test session
router.post('/start', auth, async (req, res) => {
    try {
        const { deckIds, subjectIds, questionCount, mode, timeLimit, name, filterType } = req.body;

        // Build question query based on filters
        let query = 'SELECT q.id FROM questions q JOIN decks d ON q.deck_id = d.id WHERE q.user_id = $1';
        const params = [req.user.id];

        if (deckIds && deckIds.length > 0) {
            const placeholders = deckIds.map(id => {
                params.push(id);
                return `$${params.length}`;
            }).join(',');
            query += ` AND q.deck_id IN (${placeholders})`;
        }
        if (subjectIds && subjectIds.length > 0) {
            const placeholders = subjectIds.map(id => {
                params.push(id);
                return `$${params.length}`;
            }).join(',');
            query += ` AND d.subject_id IN (${placeholders})`;
        }

        // Smart filter types
        if (filterType === 'starred') {
            query += ' AND q.starred = 1';
        } else if (filterType === 'wrong') {
            query += ' AND q.times_seen > 0 AND q.times_correct < q.times_seen';
        } else if (filterType === 'review') {
            query += ' AND (q.next_review_at IS NOT NULL AND q.next_review_at <= NOW())';
        } else if (filterType === 'unseen') {
            query += ' AND q.times_seen = 0';
        }

        query += ' ORDER BY RANDOM()';
        if (questionCount) {
            params.push(parseInt(questionCount, 10));
            query += ` LIMIT $${params.length}`;
        }

        const questionIdsRes = await db.query(query, params);
        const questionIds = questionIdsRes.rows.map(r => r.id);

        if (questionIds.length === 0) {
            return res.status(400).json({ error: 'No questions match your criteria' });
        }

        // Create test session
        const sessionRes = await db.query(`
      INSERT INTO test_sessions (user_id, name, mode, time_limit, total_questions, deck_ids, subject_ids)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id
    `, [
            req.user.id,
            name || 'Test Session',
            mode || 'untimed',
            timeLimit || 0,
            questionIds.length,
            JSON.stringify(deckIds || []),
            JSON.stringify(subjectIds || [])
        ]);

        const sessionId = sessionRes.rows[0].id;

        // Create test answer entries
        for (const qId of questionIds) {
            await db.query(
                'INSERT INTO test_answers (user_id, session_id, question_id) VALUES ($1, $2, $3)',
                [req.user.id, sessionId, qId]
            );
        }

        // Fetch full questions
        const questions = [];
        for (const id of questionIds) {
            const qRes = await db.query(`
        SELECT q.*, d.name as deck_name, s.name as subject_name
        FROM questions q
        JOIN decks d ON q.deck_id = d.id
        JOIN subjects s ON d.subject_id = s.id
        WHERE q.id = $1 AND q.user_id = $2
      `, [id, req.user.id]);
            const q = qRes.rows[0];
            if (q) {
                q.options = JSON.parse(q.options);
                questions.push(q);
            }
        }

        res.status(201).json({
            sessionId,
            totalQuestions: questionIds.length,
            mode: mode || 'untimed',
            timeLimit: timeLimit || 0,
            questions
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tests/:id/answer - Submit an answer
router.post('/:id/answer', auth, async (req, res) => {
    try {
        const { question_id, selected_index, time_spent, flagged } = req.body;
        const sessionId = req.params.id;

        // Get question to check answer
        const qRes = await db.query('SELECT * FROM questions WHERE id = $1 AND user_id = $2', [question_id, req.user.id]);
        const question = qRes.rows[0];
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const isCorrect = selected_index === question.correct_index ? 1 : 0;

        // Update test answer
        await db.query(`
      UPDATE test_answers SET selected_index = $1, is_correct = $2, time_spent = $3, flagged = $4, answered_at = NOW()
      WHERE session_id = $5 AND question_id = $6 AND user_id = $7
    `, [selected_index, isCorrect, time_spent || 0, flagged ? 1 : 0, sessionId, question_id, req.user.id]);

        // Update question stats
        await db.query(`
      UPDATE questions SET
        times_seen = times_seen + 1,
        times_correct = times_correct + $1,
        last_seen_at = NOW()
      WHERE id = $2 AND user_id = $3
    `, [isCorrect, question_id, req.user.id]);

        // Update spaced repetition
        await updateSpacedRepetition(question_id, isCorrect, req.user.id);

        // Update daily activity
        const today = new Date().toISOString().split('T')[0];
        await db.query(`
      INSERT INTO daily_activity_v2 (user_id, date, questions_answered, correct_count)
      VALUES ($1, $2, 1, $3)
      ON CONFLICT(user_id, date) DO UPDATE SET
        questions_answered = daily_activity_v2.questions_answered + 1,
        correct_count = daily_activity_v2.correct_count + $4
    `, [req.user.id, today, isCorrect, isCorrect]);

        res.json({
            is_correct: !!isCorrect,
            correct_index: question.correct_index,
            explanation: question.explanation,
            options: JSON.parse(question.options)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/tests/:id/complete - Complete a test session
router.post('/:id/complete', auth, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const ansRes = await db.query(
            'SELECT * FROM test_answers WHERE session_id = $1 AND user_id = $2',
            [sessionId, req.user.id]
        );
        const answers = ansRes.rows;

        const totalAnswered = answers.filter(a => a.selected_index !== null && a.selected_index >= 0).length;
        const correctCount = answers.filter(a => a.is_correct).length;
        const wrongCount = totalAnswered - correctCount;
        const scorePercent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100 * 10) / 10 : 0;

        await db.query(`
      UPDATE test_sessions SET
        completed = 1,
        completed_at = NOW(),
        correct_count = $1,
        wrong_count = $2,
        score_percent = $3
      WHERE id = $4 AND user_id = $5
    `, [correctCount, wrongCount, scorePercent, sessionId, req.user.id]);

        res.json({ success: true, correctCount, wrongCount, scorePercent, totalAnswered });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tests/:id/summary - Get detailed test summary
router.get('/:id/summary', auth, async (req, res) => {
    try {
        const sessionId = req.params.id;
        const sessionRes = await db.query('SELECT * FROM test_sessions WHERE id = $1 AND user_id = $2', [sessionId, req.user.id]);
        const session = sessionRes.rows[0];
        if (!session) return res.status(404).json({ error: 'Session not found' });

        session.deck_ids = JSON.parse(session.deck_ids);
        session.subject_ids = JSON.parse(session.subject_ids);

        const answersRes = await db.query(`
      SELECT ta.*, q.question_text, q.options, q.correct_index, q.explanation,
             q.deck_id, d.name as deck_name, s.name as subject_name, q.starred
      FROM test_answers ta
      JOIN questions q ON ta.question_id = q.id
      JOIN decks d ON q.deck_id = d.id
      JOIN subjects s ON d.subject_id = s.id
      WHERE ta.session_id = $1 AND ta.user_id = $2
      ORDER BY ta.id
    `, [sessionId, req.user.id]);
        const answers = answersRes.rows;

        // Parse options and compute analytics
        const detailedAnswers = answers.map(a => ({
            ...a,
            options: JSON.parse(a.options)
        }));

        // Subject performance breakdown
        const subjectPerf = {};
        for (const a of detailedAnswers) {
            if (!subjectPerf[a.subject_name]) {
                subjectPerf[a.subject_name] = { total: 0, correct: 0 };
            }
            subjectPerf[a.subject_name].total++;
            if (a.is_correct) subjectPerf[a.subject_name].correct++;
        }

        // Deck performance breakdown
        const deckPerf = {};
        for (const a of detailedAnswers) {
            if (!deckPerf[a.deck_name]) {
                deckPerf[a.deck_name] = { total: 0, correct: 0 };
            }
            deckPerf[a.deck_name].total++;
            if (a.is_correct) deckPerf[a.deck_name].correct++;
        }

        const avgTimePerQ = detailedAnswers.length > 0
            ? Math.round(detailedAnswers.reduce((sum, a) => sum + parseInt((a.time_spent || 0), 10), 0) / detailedAnswers.length)
            : 0;

        res.json({
            session,
            answers: detailedAnswers,
            analytics: {
                subjectPerformance: subjectPerf,
                deckPerformance: deckPerf,
                avgTimePerQuestion: avgTimePerQ,
                totalTime: detailedAnswers.reduce((sum, a) => sum + parseInt((a.time_spent || 0), 10), 0),
                flaggedCount: detailedAnswers.filter(a => a.flagged).length,
                starredCount: detailedAnswers.filter(a => a.starred).length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tests - List past test sessions
router.get('/', auth, async (req, res) => {
    try {
        const sessionsRes = await db.query(`
      SELECT * FROM test_sessions WHERE completed = 1 AND user_id = $1
      ORDER BY completed_at DESC LIMIT 50
    `, [req.user.id]);
        res.json(sessionsRes.rows.map(s => ({
            ...s,
            deck_ids: JSON.parse(s.deck_ids),
            subject_ids: JSON.parse(s.subject_ids)
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Spaced Repetition (SM-2 variant)
 */
async function updateSpacedRepetition(questionId, isCorrect, userId) {
    const qRes = await db.query('SELECT ease_factor, interval_days FROM questions WHERE id = $1 AND user_id = $2', [questionId, userId]);
    const q = qRes.rows[0];
    if (!q) return;

    let { ease_factor, interval_days } = q;

    if (isCorrect) {
        if (interval_days === 0) {
            interval_days = 1;
        } else if (interval_days === 1) {
            interval_days = 6;
        } else {
            interval_days = Math.round(interval_days * ease_factor);
        }
        ease_factor = Math.max(1.3, ease_factor + 0.1);
    } else {
        interval_days = 1;
        ease_factor = Math.max(1.3, ease_factor - 0.2);
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval_days);

    await db.query(`
    UPDATE questions SET ease_factor = $1, interval_days = $2, next_review_at = $3 WHERE id = $4 AND user_id = $5
  `, [ease_factor, interval_days, nextReview.toISOString(), questionId, userId]);
}

module.exports = router;
