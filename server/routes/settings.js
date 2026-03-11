const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { aiExplainAnswer } = require('../ai');

// GET /api/settings
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query('SELECT key, value FROM user_settings WHERE user_id = $1', [req.user.id]);
        const rows = result.rows;
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
router.put('/', auth, async (req, res) => {
    try {
        const updates = req.body;
        for (const [key, value] of Object.entries(updates)) {
            // Don't overwrite with masked value
            if (key.includes('api_key') && value && value.startsWith('••••')) continue;
            await db.query('INSERT INTO user_settings (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value', [req.user.id, key, value]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/settings/explain - AI explanation for a question
router.post('/explain', auth, async (req, res) => {
    try {
        const { question_id } = req.body;
        const questionRes = await db.query('SELECT * FROM questions WHERE id = $1 AND user_id = $2', [question_id, req.user.id]);
        const question = questionRes.rows[0];
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const options = JSON.parse(question.options);

        // Check for API key
        const rowsRes = await db.query('SELECT key, value FROM user_settings WHERE user_id = $1', [req.user.id]);
        const settings = {};
        rowsRes.rows.forEach(r => settings[r.key] = r.value);

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
        await db.query('UPDATE questions SET explanation = $1 WHERE id = $2 AND user_id = $3', [explanation, question_id, req.user.id]);

        res.json({ explanation, source: preferred });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
