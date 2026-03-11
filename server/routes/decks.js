const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/decks - List decks, optionally filtered by subjectId
router.get('/', auth, (req, res) => {
    try {
        const { subjectId } = req.query;
        let query = `
      SELECT d.*, s.name as subject_name, s.color as subject_color,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ?) as question_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ? AND times_seen > 0) as seen_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ? AND starred = 1) as starred_count,
        CASE WHEN (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ?) > 0
          THEN ROUND(
            (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ? AND times_seen > 0) * 100.0 /
            (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ?), 1
          ) ELSE 0 END as progress_percent
      FROM decks d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.user_id = ?
    `;
        const params = [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id];
        if (subjectId) {
            query += ' AND d.subject_id = ?';
            params.push(subjectId);
        }
        query += ' ORDER BY d.created_at DESC';
        const decks = db.prepare(query).all(...params);
        res.json(decks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/decks/:id
router.get('/:id', auth, (req, res) => {
    try {
        const deck = db.prepare(`
      SELECT d.*, s.name as subject_name, s.color as subject_color,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ?) as question_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ? AND times_seen > 0) as seen_count,
        (SELECT COUNT(*) FROM questions WHERE deck_id = d.id AND user_id = ? AND starred = 1) as starred_count
      FROM decks d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.id = ? AND d.user_id = ?
    `).get(req.user.id, req.user.id, req.user.id, req.params.id, req.user.id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        res.json(deck);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/decks
router.post('/', auth, (req, res) => {
    try {
        const { name, description, subject_id } = req.body;
        if (!name || !subject_id) return res.status(400).json({ error: 'Name and subject_id required' });
        const result = db.prepare(
            'INSERT INTO decks (user_id, name, description, subject_id) VALUES (?, ?, ?, ?)'
        ).run(req.user.id, name, description || '', subject_id);
        const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
        res.status(201).json(deck);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/decks/:id
router.put('/:id', auth, (req, res) => {
    try {
        const { name, description, subject_id } = req.body;
        db.prepare(
            'UPDATE decks SET name = COALESCE(?, name), description = COALESCE(?, description), subject_id = COALESCE(?, subject_id) WHERE id = ? AND user_id = ?'
        ).run(name, description, subject_id, req.params.id, req.user.id);
        const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        res.json(deck);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/decks/:id
router.delete('/:id', auth, (req, res) => {
    try {
        db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/decks/:id/reset - Reset deck progress
router.post('/:id/reset', auth, (req, res) => {
    try {
        db.prepare(`
      UPDATE questions SET 
        times_seen = 0, times_correct = 0, starred = 0,
        last_seen_at = NULL, next_review_at = NULL,
        ease_factor = 2.5, interval_days = 0
      WHERE deck_id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);
        // Also delete test answers for this deck's questions
        db.prepare(`
      DELETE FROM test_answers WHERE user_id = ? AND question_id IN (
        SELECT id FROM questions WHERE deck_id = ? AND user_id = ?
      )
    `).run(req.user.id, req.params.id, req.user.id);
        res.json({ success: true, message: 'Deck progress reset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
