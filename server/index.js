const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Initialize database (runs migrations)
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.path}`);
    next();
});
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve static React files in production
const distPath = path.resolve(__dirname, '../dist');
console.log(`[BOOT] Attempting to serve static frontend from: ${distPath}`);

if (fs.existsSync(distPath)) {
    console.log(`[BOOT] SUCCESS: Dist directory found, mounting static files.`);
    app.use(express.static(distPath));
} else {
    console.warn(`[WARNING] Static React dist folder not found at: ${distPath}`);
}

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/decks', require('./routes/decks'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/tests', require('./routes/tests'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/import', require('./routes/import'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Explicitly serve the root path
app.get('/', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(503).send('Production build not found. Please run npm run build.');
    }
});

// Catch-all route for React Router
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`\n  🏥 MedQuiz Server running on http://localhost:${PORT}\n`);
});
