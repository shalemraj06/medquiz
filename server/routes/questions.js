const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/questions - List questions, filtered by deckId, starred, wrong, etc.
router.get('/', auth, (req, res) => {
    try {
        const { deckId, subjectId, starred, wrong, review, limit } = req.query;
        let query = `
      SELECT q.*, d.name as deck_name, d.subject_id, s.name as subject_name
      FROM questions q
      JOIN decks d ON q.deck_id = d.id
      JOIN subjects s ON d.subject_id = s.id
      WHERE q.user_id = ?
    `;
        const params = [req.user.id];

        if (deckId) { query += ' AND q.deck_id = ?'; params.push(deckId); }
        if (subjectId) { query += ' AND d.subject_id = ?'; params.push(subjectId); }
        if (starred === '1') { query += ' AND q.starred = 1'; }
        if (wrong === '1') { query += ' AND q.times_seen > 0 AND q.times_correct < q.times_seen'; }
        if (review === '1') {
            query += ' AND (q.next_review_at IS NULL OR q.next_review_at <= datetime("now"))';
        }

        query += ' ORDER BY q.created_at DESC';
        if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

        const questions = db.prepare(query).all(...params);
        // Parse options JSON
        const parsed = questions.map(q => ({
            ...q,
            options: JSON.parse(q.options)
        }));
        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/questions/:id
router.get('/:id', auth, (req, res) => {
    try {
        const q = db.prepare(`
      SELECT q.*, d.name as deck_name, s.name as subject_name
      FROM questions q
      JOIN decks d ON q.deck_id = d.id
      JOIN subjects s ON d.subject_id = s.id
      WHERE q.id = ? AND q.user_id = ?
    `).get(req.params.id, req.user.id);
        if (!q) return res.status(404).json({ error: 'Question not found' });
        q.options = JSON.parse(q.options);
        res.json(q);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/questions/:id - Update question (star/unstar, edit, etc.)
router.put('/:id', auth, (req, res) => {
    try {
        const { starred, question_text, options, correct_index, explanation } = req.body;
        const updates = [];
        const params = [];

        if (starred !== undefined) { updates.push('starred = ?'); params.push(starred ? 1 : 0); }
        if (question_text !== undefined) { updates.push('question_text = ?'); params.push(question_text); }
        if (options !== undefined) { updates.push('options = ?'); params.push(JSON.stringify(options)); }
        if (correct_index !== undefined) { updates.push('correct_index = ?'); params.push(correct_index); }
        if (explanation !== undefined) { updates.push('explanation = ?'); params.push(explanation); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(req.params.id, req.user.id);
        db.prepare(`UPDATE questions SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`).run(...params);
        const q = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
        q.options = JSON.parse(q.options);
        res.json(q);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/questions/:id/move - Move question to আরেকটা deck
router.post('/:id/move', auth, (req, res) => {
    try {
        const { deck_id } = req.body;
        if (!deck_id) return res.status(400).json({ error: 'deck_id required' });
        db.prepare('UPDATE questions SET deck_id = ? WHERE id = ? AND user_id = ?').run(deck_id, req.params.id, req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/questions/:id
router.delete('/:id', auth, (req, res) => {
    try {
        db.prepare('DELETE FROM questions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/questions/:id/note - Get user note for a question
router.get('/:id/note', auth, (req, res) => {
    try {
        const note = db.prepare('SELECT note_text FROM user_notes WHERE question_id = ? AND user_id = ?').get(req.params.id, req.user.id);
        res.json({ note_text: note ? note.note_text : '' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/questions/:id/note - Save user note for a question
router.post('/:id/note', auth, (req, res) => {
    try {
        const { note_text } = req.body;
        db.prepare(`
            INSERT INTO user_notes (user_id, question_id, note_text, updated_at) 
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, question_id) DO UPDATE SET note_text = excluded.note_text, updated_at = CURRENT_TIMESTAMP
        `).run(req.user.id, req.params.id, note_text || '');
        res.json({ success: true, note_text });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
