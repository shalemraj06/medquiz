const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { aiExplainAnswer } = require('../ai');

// GET /api/settings
router.get('/', auth, (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(req.user.id);
        const settings = {};
        rows.forEach(r => {
            // Mask API keys for security
            if (r.key.includes('api_key') && r.value) {
                settings[r.key] = r.value ? '••••' + r.value.slice(-4) : '';
                settings[r.key + '_set'] = !!r.value;
            } else {
                settings[r.key] = r.value;
            }
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/settings
router.put('/', auth, (req, res) => {
    try {
        const updates = req.body;
        const upsert = db.prepare('INSERT OR REPLACE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)');
        const updateMany = db.transaction((entries) => {
            for (const [key, value] of entries) {
                // Don't overwrite with masked value
                if (key.includes('api_key') && value && value.startsWith('••••')) continue;
                upsert.run(req.user.id, key, value);
            }
        });
        updateMany(Object.entries(updates));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/explain - AI explanation for a question
router.post('/explain', auth, async (req, res) => {
    try {
        const { question_id } = req.body;
        const question = db.prepare('SELECT * FROM questions WHERE id = ? AND user_id = ?').get(question_id, req.user.id);
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const options = JSON.parse(question.options);

        // Check for API key
        const rows = db.prepare('SELECT key, value FROM user_settings WHERE user_id = ?').all(req.user.id);
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);

        let explanation = null;
        const preferred = settings.preferred_ai || 'local';

        if (preferred === 'claude' && settings.claude_api_key) {
            explanation = await aiExplainAnswer(
                question.question_text, options, question.correct_index,
                settings.claude_api_key, 'claude'
            );
        } else if (preferred === 'gemini' && settings.gemini_api_key) {
            explanation = await aiExplainAnswer(
                question.question_text, options, question.correct_index,
                settings.gemini_api_key, 'gemini'
            );
        }

        if (!explanation) {
            return res.json({
                explanation: question.explanation || 'No explanation available. Configure an AI API key in Settings for AI-generated explanations.',
                source: 'local'
            });
        }

        // Save the explanation
        db.prepare('UPDATE questions SET explanation = ? WHERE id = ? AND user_id = ?').run(explanation, question_id, req.user.id);

        res.json({ explanation, source: preferred });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
