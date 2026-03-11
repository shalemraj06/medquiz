const express = require('express');
const router = express.Router();
const db = require('../db');
const { parseQuestions, suggestSubject, shuffleArray } = require('../parser');
const { aiParseQuestions } = require('../ai');
const multer = require('multer');
const mammoth = require('mammoth');
const auth = require('../middleware/auth');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// POST /api/import/parse - Parse raw input into structured MCQs
router.post('/parse', auth, async (req, res) => {
    try {
        const { rawInput } = req.body;
        if (!rawInput || !rawInput.trim()) {
            return res.status(400).json({ error: 'Input text is required' });
        }

        let questions = null;

        // Try AI parsing first if API key is available
        const settingsRes = await db.query('SELECT key, value FROM user_settings WHERE user_id = $1', [req.user.id]);
        const settings = {};
        settingsRes.rows.forEach(r => settings[r.key] = r.value);

        const preferredAi = settings.preferred_ai || 'local';

        if (preferredAi === 'claude' && settings.claude_api_key) {
            questions = await aiParseQuestions(rawInput, settings.claude_api_key, 'claude');
        } else if (preferredAi === 'gemini' && settings.gemini_api_key) {
            questions = await aiParseQuestions(rawInput, settings.gemini_api_key, 'gemini');
        }

        // Fallback to local parser
        if (!questions || questions.length === 0) {
            questions = parseQuestions(rawInput);
        } else {
            questions = questions.map(q => {
                if (!q.options || q.options.length === 0) return q;
                const correctAnswer = q.options[q.correct_index];
                const shuffled = shuffleArray(q.options);
                const newCorrectIndex = shuffled.indexOf(correctAnswer);
                return { ...q, options: shuffled, correct_index: newCorrectIndex };
            });
        }

        if (questions.length === 0) {
            return res.status(400).json({ error: 'Could not parse any questions from the input. Try a different format.' });
        }

        const existingSubjRes = await db.query('SELECT * FROM subjects WHERE user_id = $1', [req.user.id]);
        const existingSubjects = existingSubjRes.rows;
        const suggestions = suggestSubject(questions, existingSubjects);

        const decksRes = await db.query(`
      SELECT d.*, s.name as subject_name FROM decks d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.user_id = $1
      ORDER BY s.name, d.name
    `, [req.user.id]);
        const decks = decksRes.rows;

        res.json({
            questions,
            totalParsed: questions.length,
            subjectSuggestions: suggestions,
            existingSubjects,
            existingDecks: decks
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/import/parse-file - Parse uploaded file into structured MCQs
// Accepts: .html, .htm, .jsx, .tsx, .md, .txt, .docx
router.post('/parse-file', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileName = req.file.originalname.toLowerCase();
        const ext = fileName.substring(fileName.lastIndexOf('.'));
        let fileContent = '';

        // Handle DOCX separately — convert to HTML first via mammoth
        if (ext === '.docx') {
            try {
                const result = await mammoth.convertToHtml({ buffer: req.file.buffer });
                fileContent = result.value; // HTML string
            } catch (docxErr) {
                return res.status(400).json({ error: 'Failed to read DOCX file: ' + docxErr.message });
            }
        } else {
            // All other formats: read as UTF-8 text
            fileContent = req.file.buffer.toString('utf-8');
        }

        if (!fileContent || !fileContent.trim()) {
            return res.status(400).json({ error: 'File appears to be empty.' });
        }

        // For .md files, convert markdown bold/italic to help the parser
        if (ext === '.md') {
            fileContent = convertMarkdownToText(fileContent);
        }

        // Parse questions using our universal parser
        let questions = parseQuestions(fileContent);

        if (!questions || questions.length === 0) {
            return res.status(400).json({
                error: `Could not parse any questions from the ${ext} file. ` +
                    `Ensure the file contains MCQs in a recognizable format (numbered questions with lettered options).`
            });
        }

        const existingSubjRes = await db.query('SELECT * FROM subjects WHERE user_id = $1', [req.user.id]);
        const existingSubjects = existingSubjRes.rows;
        const suggestions = suggestSubject(questions, existingSubjects);

        const decksRes = await db.query(`
      SELECT d.*, s.name as subject_name FROM decks d
      JOIN subjects s ON d.subject_id = s.id
      WHERE d.user_id = $1
      ORDER BY s.name, d.name
    `, [req.user.id]);
        const decks = decksRes.rows;

        res.json({
            questions,
            totalParsed: questions.length,
            fileType: ext,
            subjectSuggestions: suggestions,
            existingSubjects,
            existingDecks: decks
        });
    } catch (err) {
        console.error('File parse error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * Convert common Markdown formatting to plain text for better parsing.
 * Strips bold (**text**), italic (*text*), headings (#), code blocks, etc.
 */
function convertMarkdownToText(md) {
    return md
        // Remove code fences
        .replace(/\`\`\`[\s\S]*?\`\`\`/g, '')
        .replace(/\`([^\`]+)\`/g, '$1')
        // Convert headings to plain text
        .replace(/^#{1,6}\s+/gm, '')
        // Bold and italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/___(.+?)___/g, '$1')
        .replace(/__(.+?)__/g, '$1')
        .replace(/_(.+?)_/g, '$1')
        // Horizontal rules
        .replace(/^[-*_]{3,}\s*$/gm, '')
        // Links
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Images
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        // Blockquotes
        .replace(/^>\s?/gm, '')
        .trim();
}

// POST /api/import/save - Save parsed questions to a deck
router.post('/save', auth, async (req, res) => {
    try {
        const { questions, deck_id, new_deck_name, subject_id, new_subject_name, new_subject_color } = req.body;

        if (!questions || questions.length === 0) {
            return res.status(400).json({ error: 'No questions to save' });
        }

        let targetDeckId = deck_id;

        // Create new subject if needed
        let targetSubjectId = subject_id;
        if (new_subject_name && !subject_id) {
            const subjRes = await db.query(
                'INSERT INTO subjects (user_id, name, color) VALUES ($1, $2, $3) RETURNING id',
                [req.user.id, new_subject_name, new_subject_color || '#3b82f6']
            );
            targetSubjectId = subjRes.rows[0].id;
        }

        // Create new deck if needed
        if (new_deck_name && !deck_id) {
            if (!targetSubjectId) {
                return res.status(400).json({ error: 'Subject is required when creating a new deck' });
            }
            const deckRes = await db.query(
                'INSERT INTO decks (user_id, name, subject_id) VALUES ($1, $2, $3) RETURNING id',
                [req.user.id, new_deck_name, targetSubjectId]
            );
            targetDeckId = deckRes.rows[0].id;
        }

        if (!targetDeckId) {
            return res.status(400).json({ error: 'A deck must be specified or created' });
        }

        // Insert all questions sequentially
        for (const q of questions) {
            await db.query(`
              INSERT INTO questions (user_id, deck_id, question_text, options, correct_index, explanation)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                req.user.id,
                targetDeckId,
                q.question_text,
                JSON.stringify(q.options),
                q.correct_index,
                q.explanation || ''
            ]);
        }

        res.status(201).json({
            success: true,
            count: questions.length,
            deckId: targetDeckId,
            subjectId: targetSubjectId
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
