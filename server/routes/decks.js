const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/decks - List decks, optionally filtered by subjectId
router.get('/', auth, async (req, res) => {
    try {
        const { subjectId } = req.query;
        let query = `
      SELECT d.*, s.name as subject_name, s.color as subject_color,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $1) as question_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $2 AND times_seen > 0) as seen_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $3 AND starred = 1) as starred_count,
        CASE WHEN (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $4) > 0
          THEN ROUND(
            (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $5 AND times_seen > 0) * 100.0 /
            (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $6), 1
          ) ELSE 0 END as progress_percent
      FROM decks d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.user_id = $7
    `;
        const params = [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id];
        if (subjectId) {
            query += ' AND d.subject_id = $8';
            params.push(subjectId);
        }
        query += ' ORDER BY d.created_at DESC';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/decks/:id
router.get('/:id', auth, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT d.*, s.name as subject_name, s.color as subject_color,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $1) as question_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $2 AND times_seen > 0) as seen_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = $3 AND starred = 1) as starred_count
      FROM decks d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = $4 AND d.user_id = $5
    `, [req.user.id, req.user.id, req.user.id, req.params.id, req.user.id]);
        const deck = result.rows[0];
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        res.json(deck);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/decks
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, subject_id } = req.body;
        if (!name || !subject_id) return res.status(400).json({ error: 'Name and subject_id required' });
        const result = await db.query(
            'INSERT INTO decks (user_id, name, description, subject_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [req.user.id, name, description || '', subject_id]
        );
        const deckRes = await db.query('SELECT * FROM decks WHERE id = $1 AND user_id = $2', [result.rows[0].id, req.user.id]);
        res.status(201).json(deckRes.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/decks/:id
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, description, subject_id } = req.body;
        await db.query(
            'UPDATE decks SET name = COALESCE($1, name), description = COALESCE($2, description), subject_id = COALESCE($3, subject_id) WHERE id = $4 AND user_id = $5',
            [name, description, subject_id, req.params.id, req.user.id]
        );
        const deckRes = await db.query('SELECT * FROM decks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json(deckRes.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/decks/:id
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query('DELETE FROM decks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/decks/:id/reset - Reset deck progress
router.post('/:id/reset', auth, async (req, res) => {
    try {
        await db.query(`
      UPDATE questions SET 
        times_seen = 0, times_correct = 0, starred = 0,
        last_seen_at = NULL, next_review_at = NULL,
        ease_factor = 2.5, interval_days = 0
      WHERE deck_id = $1 AND user_id = $2
    `, [req.params.id, req.user.id]);
        // Also delete test answers for this deck's questions
        await db.query(`
      DELETE FROM test_answers WHERE user_id = $1 AND question_id IN (
        SELECT id FROM questions WHERE deck_id = $2 AND user_id = $3
      )
    `, [req.user.id, req.params.id, req.user.id]);
        res.json({ success: true, message: 'Deck progress reset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
