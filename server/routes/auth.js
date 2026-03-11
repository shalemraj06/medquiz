const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'medquiz_local_secret_key_12345';

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Please enter all fields' });
        }

        // Check for existing user
        const existingUser = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        // Create salt & hash
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        // Insert new user
        const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, hash);
        const user_id = result.lastInsertRowid;

        // Sign JWT
        jwt.sign(
            { user: { id: user_id, username } },
            JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: { id: user_id, username, role: 'user' }
                });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Please enter all fields' });
        }

        // Check for existing user
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Sign JWT
        jwt.sign(
            { user: { id: user.id, username: user.username } },
            JWT_SECRET,
            { expiresIn: '30d' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: { id: user.id, username: user.username, role: user.role }
                });
            }
        );
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me
// Get currently logged in user info
router.get('/me', auth, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
