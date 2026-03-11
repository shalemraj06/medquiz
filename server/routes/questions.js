const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/questions - List questions, filtered by deckId, starred, wrong, etc.
router.get('/', auth, async (req, res) => {
    try {
        const { deckId, subjectId, starred, wrong, review, limit } = req.query;
        let query = `
      SELECT q.*, d.name as deck_name, d.subject_id, s.name as subject_name
      FROM questions q
      JOIN decks d ON q.deck_id = d.id
      JOIN subjects s ON d.subject_id = s.id
      WHERE q.user_id = $1
    `;
        const params = [req.user.id];

        if (deckId) { params.push(deckId); query += ` AND q.deck_id = $${params.length}`; }
        if (subjectId) { params.push(subjectId); query += ` AND d.subject_id = $${params.length}`; }
        if (starred === '1') { query += ' AND q.starred = 1'; }
        if (wrong === '1') { query += ' AND q.times_seen > 0 AND q.times_correct < q.times_seen'; }
        if (review === '1') {
            query += ' AND (q.next_review_at IS NULL OR q.next_review_at <= NOW())';
        }

        query += ' ORDER BY q.created_at DESC';
        if (limit) { params.push(parseInt(limit, 10)); query += ` LIMIT $${params.length}`; }

        const questionsResult = await db.query(query, params);
        // Parse options JSON
        const parsed = questionsResult.rows.map(q => ({
            ...q,
            options: JSON.parse(q.options)
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/questions/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT q.*, d.name as deck_name, s.name as subject_name
      FROM questions q
      JOIN decks d ON q.deck_id = d.id
      JOIN subjects s ON d.subject_id = s.id
      WHERE q.id = $1 AND q.user_id = $2
    `, [req.params.id, req.user.id]);

        const q = result.rows[0];
        if (!q) return res.status(404).json({ error: 'Question not found' });
        q.options = JSON.parse(q.options);
        res.json(q);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/questions/:id - Update question (star/unstar, edit, etc.)
router.put('/:id', auth, async (req, res) => {
    try {
        const { starred, question_text, options, correct_index, explanation } = req.body;
        const updates = [];
        const params = [];

        if (starred !== undefined) { params.push(starred ? 1 : 0); updates.push(`starred = $${params.length}`); }
        if (question_text !== undefined) { params.push(question_text); updates.push(`question_text = $${params.length}`); }
        if (options !== undefined) { params.push(JSON.stringify(options)); updates.push(`options = $${params.length}`); }
        if (correct_index !== undefined) { params.push(correct_index); updates.push(`correct_index = $${params.length}`); }
        if (explanation !== undefined) { params.push(explanation); updates.push(`explanation = $${params.length}`); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(req.params.id); const idIndex = params.length;
        params.push(req.user.id); const userIndex = params.length;

        await db.query(`UPDATE questions SET ${updates.join(', ')} WHERE id = $${idIndex} AND user_id = $${userIndex}`, params);

        const qRes = await db.query('SELECT * FROM questions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        const q = qRes.rows[0];
        if (q) q.options = JSON.parse(q.options);

        res.json(q);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/questions/:id/move - Move question to another deck
router.post('/:id/move', auth, async (req, res) => {
    try {
        const { deck_id } = req.body;
        if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
        await db.query('UPDATE questions SET deck_id = $1 WHERE id = $2 AND user_id = $3', [deck_id, req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/questions/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query('DELETE FROM questions WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/questions/:id/note - Get user note for a question
router.get('/:id/note', auth, async (req, res) => {
    try {
        const result = await db.query('SELECT note_text FROM user_notes WHERE question_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        const note = result.rows[0];
        res.json({ note_text: note ? note.note_text : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/questions/:id/note - Save user note for a question
router.post('/:id/note', auth, async (req, res) => {
    try {
        const { note_text } = req.body;
        await db.query(`
            INSERT INTO user_notes (user_id, question_id, note_text, updated_at) 
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, question_id) DO UPDATE SET note_text = EXCLUDED.note_text, updated_at = CURRENT_TIMESTAMP
        `, [req.user.id, req.params.id, note_text || '']);
        res.json({ success: true, note_text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
