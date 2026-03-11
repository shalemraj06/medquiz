const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/subjects - List all subjects with stats
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM decks WHERE subject_id = s.id AND user_id = $1) as deck_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = $2) as question_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = $3 AND q.times_seen > 0) as seen_count
      FROM subjects s
      WHERE s.user_id = $4
      ORDER BY s.created_at DESC
    `, [req.user.id, req.user.id, req.user.id, req.user.id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/subjects/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT s.*,
        (SELECT COUNT(*) FROM decks WHERE subject_id = s.id AND user_id = $1) as deck_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = $2) as question_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = $3 AND q.times_seen > 0) as seen_count
      FROM subjects s WHERE s.id = $4 AND s.user_id = $5
    `, [req.user.id, req.user.id, req.user.id, req.params.id, req.user.id]);

        const subject = result.rows[0];
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/subjects
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, color, icon } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const insertRes = await db.query(
            'INSERT INTO subjects (user_id, name, description, color, icon) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [req.user.id, name, description || '', color || '#3b82f6', icon || '📚']
        );
        const result = await db.query('SELECT * FROM subjects WHERE id = $1 AND user_id = $2', [insertRes.rows[0].id, req.user.id]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/subjects/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, description, color, icon } = req.body;
        await db.query(
            'UPDATE subjects SET name = COALESCE($1, name), description = COALESCE($2, description), color = COALESCE($3, color), icon = COALESCE($4, icon) WHERE id = $5 AND user_id = $6',
            [name, description, color, icon, req.params.id, req.user.id]
        );
        const result = await db.query('SELECT * FROM subjects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/subjects/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query('DELETE FROM subjects WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
