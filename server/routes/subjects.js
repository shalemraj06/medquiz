const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/subjects - List all subjects with stats
router.get('/', auth, (req, res) => {
    try {
        const subjects = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM decks WHERE subject_id = s.id AND user_id = ?) as deck_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = ?) as question_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = ? AND q.times_seen > 0) as seen_count
      FROM subjects s
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id);
        res.json(subjects);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/subjects/:id
router.get('/:id', auth, (req, res) => {
    try {
        const subject = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM decks WHERE subject_id = s.id AND user_id = ?) as deck_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = ?) as question_count,
        (SELECT COUNT(*) FROM questions q JOIN decks d ON q.deck_id = d.id WHERE d.subject_id = s.id AND q.user_id = ? AND q.times_seen > 0) as seen_count
      FROM subjects s WHERE s.id = ? AND s.user_id = ?
    `).get(req.user.id, req.user.id, req.user.id, req.params.id, req.user.id);
        if (!subject) return res.status(404).json({ error: 'Subject not found' });
        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/subjects
router.post('/', auth, (req, res) => {
    try {
        const { name, description, color, icon } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });
        const result = db.prepare(
            'INSERT INTO subjects (user_id, name, description, color, icon) VALUES (?, ?, ?, ?, ?)'
        ).run(req.user.id, name, description || '', color || '#3b82f6', icon || '📚');
        const subject = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
        res.status(201).json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/subjects/:id
router.put('/:id', auth, (req, res) => {
    try {
        const { name, description, color, icon } = req.body;
        db.prepare(
            'UPDATE subjects SET name = COALESCE(?, name), description = COALESCE(?, description), color = COALESCE(?, color), icon = COALESCE(?, icon) WHERE id = ? AND user_id = ?'
        ).run(name, description, color, icon, req.params.id, req.user.id);
        const subject = db.prepare('SELECT * FROM subjects WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        res.json(subject);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/subjects/:id
router.delete('/:id', auth, (req, res) => {
    try {
        db.prepare('DELETE FROM subjects WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
