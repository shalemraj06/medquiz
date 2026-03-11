const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// POST /api/tests/start - Start a new test session
router.post('/start', auth, (req, res) => {
    try {
        const { deckIds, subjectIds, questionCount, mode, timeLimit, name, filterType } = req.body;

        // Build question query based on filters
        let query = 'SELECT q.id FROM questions q JOIN decks d ON q.deck_id = d.id WHERE q.user_id = ?';
        const params = [req.user.id];

        if (deckIds && deckIds.length > 0) {
            query += ` AND q.deck_id IN (${deckIds.map(() => '?').join(',')})`;
            params.push(...deckIds);
        }
        if (subjectIds && subjectIds.length > 0) {
            query += ` AND d.subject_id IN (${subjectIds.map(() => '?').join(',')})`;
            params.push(...subjectIds);
        }

        // Smart filter types
        if (filterType === 'starred') {
            query += ' AND q.starred = 1';
        } else if (filterType === 'wrong') {
            query += ' AND q.times_seen > 0 AND q.times_correct < q.times_seen';
        } else if (filterType === 'review') {
            query += ' AND (q.next_review_at IS NOT NULL AND q.next_review_at <= datetime("now"))';
        } else if (filterType === 'unseen') {
            query += ' AND q.times_seen = 0';
        }

        query += ' ORDER BY RANDOM()';
        if (questionCount) {
            query += ' LIMIT ?';
            params.push(questionCount);
        }

        const questionIds = db.prepare(query).all(...params).map(r => r.id);

        if (questionIds.length === 0) {
            return res.status(400).json({ error: 'No questions match your criteria' });
        }

        // Create test session
        const result = db.prepare(`
      INSERT INTO test_sessions (user_id, name, mode, time_limit, total_questions, deck_ids, subject_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
            req.user.id,
            name || 'Test Session',
            mode || 'untimed',
            timeLimit || 0,
            questionIds.length,
            JSON.stringify(deckIds || []),
            JSON.stringify(subjectIds || [])
        );

        const sessionId = result.lastInsertRowid;

        // Create test answer entries
        const insertAnswer = db.prepare(
            'INSERT INTO test_answers (user_id, session_id, question_id) VALUES (?, ?, ?)'
        );
        const insertMany = db.transaction((ids) => {
            for (const qId of ids) {
                insertAnswer.run(req.user.id, sessionId, qId);
            }
        });
        insertMany(questionIds);

        // Fetch full questions
        const questions = questionIds.map(id => {
            const q = db.prepare(`
        SELECT q.*, d.name as deck_name, s.name as subject_name
        FROM questions q
        JOIN decks d ON q.deck_id = d.id
        JOIN subjects s ON d.subject_id = s.id
        WHERE q.id = ? AND q.user_id = ?
      `).get(id, req.user.id);
            q.options = JSON.parse(q.options);
            return q;
        });

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
router.post('/:id/answer', auth, (req, res) => {
    try {
        const { question_id, selected_index, time_spent, flagged } = req.body;
        const sessionId = req.params.id;

        // Get question to check answer
        const question = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(question_id, req.user.id);
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const isCorrect = selected_index === question.correct_index ? 1 : 0;

        // Update test answer
        db.prepare(`
      UPDATE test_answers SET selected_index = ?, is_correct = ?, time_spent = ?, flagged = ?, answered_at = datetime('now')
      WHERE session_id = ? AND question_id = ? AND user_id = ?
    `).run(selected_index, isCorrect, time_spent || 0, flagged ? 1 : 0, sessionId, question_id, req.user.id);

        // Update question stats
        db.prepare(`
      UPDATE questions SET
        times_seen = times_seen + 1,
        times_correct = times_correct + ?,
        last_seen_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(isCorrect, question_id, req.user.id);

        // Update spaced repetition
        updateSpacedRepetition(question_id, isCorrect, req.user.id);

        // Update daily activity
        const today = new Date().toISOString().split('T')[0];
        db.prepare(`
      INSERT INTO daily_activity_v2 (user_id, date, questions_answered, correct_count)
      VALUES (?, ?, 1, ?)
      ON CONFLICT(user_id, date) DO UPDATE SET
        questions_answered = questions_answered + 1,
        correct_count = correct_count + ?
    `).run(req.user.id, today, isCorrect, isCorrect);

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
router.post('/:id/complete', auth, (req, res) => {
    try {
        const sessionId = req.params.id;
        const answers = db.prepare(
            'SELECT * FROM test_answers WHERE session_id = ? AND user_id = ?'
        ).all(sessionId, req.user.id);

        const totalAnswered = answers.filter(a => a.selected_index >= 0).length;
        const correctCount = answers.filter(a => a.is_correct).length;
        const wrongCount = totalAnswered - correctCount;
        const scorePercent = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100 * 10) / 10 : 0;

        db.prepare(`
      UPDATE test_sessions SET
        completed = 1,
        completed_at = datetime('now'),
        correct_count = ?,
        wrong_count = ?,
        score_percent = ?
      WHERE id = ? AND user_id = ?
    `).run(correctCount, wrongCount, scorePercent, sessionId, req.user.id);

        res.json({ success: true, correctCount, wrongCount, scorePercent, totalAnswered });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tests/:id/summary - Get detailed test summary
router.get('/:id/summary', auth, (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = db.prepare('SELECT * FROM test_sessions WHERE id = ? AND user_id = ?').get(sessionId, req.user.id);
        if (!session) return res.status(404).json({ error: 'Session not found' });

        session.deck_ids = JSON.parse(session.deck_ids);
        session.subject_ids = JSON.parse(session.subject_ids);

        const answers = db.prepare(`
      SELECT ta.*, q.question_text, q.options, q.correct_index, q.explanation,
             q.deck_id, d.name as deck_name, s.name as subject_name, q.starred
      FROM test_answers ta
      JOIN questions q ON ta.question_id = q.id
      JOIN decks d ON q.deck_id = d.id
      JOIN subjects s ON d.subject_id = s.id
      WHERE ta.session_id = ? AND ta.user_id = ?
      ORDER BY ta.id
    `).all(sessionId, req.user.id);

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
            ? Math.round(detailedAnswers.reduce((sum, a) => sum + (a.time_spent || 0), 0) / detailedAnswers.length)
            : 0;

        res.json({
            session,
            answers: detailedAnswers,
            analytics: {
                subjectPerformance: subjectPerf,
                deckPerformance: deckPerf,
                avgTimePerQuestion: avgTimePerQ,
                totalTime: detailedAnswers.reduce((sum, a) => sum + (a.time_spent || 0), 0),
                flaggedCount: detailedAnswers.filter(a => a.flagged).length,
                starredCount: detailedAnswers.filter(a => a.starred).length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/tests - List past test sessions
router.get('/', auth, (req, res) => {
    try {
        const sessions = db.prepare(`
      SELECT * FROM test_sessions WHERE completed = 1 AND user_id = ?
      ORDER BY completed_at DESC LIMIT 50
    `).all(req.user.id);
        res.json(sessions.map(s => ({
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
function updateSpacedRepetition(questionId, isCorrect, userId) {
    const q = db.prepare('SELECT ease_factor, interval_days FROM questions WHERE id = ? AND user_id = ?').get(questionId, userId);
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

    db.prepare(`
    UPDATE questions SET ease_factor = ?, interval_days = ?, next_review_at = ? WHERE id = ? AND user_id = ?
  `).run(ease_factor, interval_days, nextReview.toISOString(), questionId, userId);
}

module.exports = router;
