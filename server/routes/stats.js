const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/stats/dashboard - Overall dashboard stats for the user
router.get('/dashboard', auth, (req, res) => {
    try {
        const totalQuestions = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ?').get(req.user.id).count;
        const totalSeen = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND times_seen > 0').get(req.user.id).count;
        const totalStarred = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND starred = 1').get(req.user.id).count;
        const totalSubjects = db.prepare('SELECT COUNT(*) as count FROM subjects WHERE user_id = ?').get(req.user.id).count;
        const totalDecks = db.prepare('SELECT COUNT(*) as count FROM decks WHERE user_id = ?').get(req.user.id).count;

        // Completed sessions stats
        const sessions = db.prepare('SELECT * FROM test_sessions WHERE completed = 1 AND user_id = ?').all(req.user.id);
        const completedTests = sessions.length;
        const avgScore = sessions.length > 0
            ? Math.round(sessions.reduce((sum, s) => sum + s.score_percent, 0) / sessions.length * 10) / 10
            : 0;

        // Daily streak calculation
        const streak = calculateStreak(req.user.id);

        // Today's activity
        const today = new Date().toISOString().split('T')[0];
        const todayActivity = db.prepare('SELECT * FROM daily_activity_v2 WHERE user_id = ? AND date = ?').get(req.user.id, today);

        // Recent activity (last 7 days)
        const recentActivity = db.prepare(`
      SELECT * FROM daily_activity_v2
      WHERE user_id = ? AND date >= date('now', '-7 days')
      ORDER BY date DESC
    `).all(req.user.id);

        // Questions due for review
        const reviewDue = db.prepare(`
      SELECT COUNT(*) as count FROM questions
      WHERE user_id = ? AND next_review_at IS NOT NULL AND next_review_at <= datetime('now')
    `).get(req.user.id).count;

        // Wrong answers count (questions answered wrong at least once)
        const wrongCount = db.prepare(`
      SELECT COUNT(*) as count FROM questions
      WHERE user_id = ? AND times_seen > 0 AND times_correct < times_seen
    `).get(req.user.id).count;

        res.json({
            totalQuestions,
            totalSeen,
            totalStarred,
            totalSubjects,
            totalDecks,
            completedTests,
            avgScore,
            streak,
            todayActivity: todayActivity || { questions_answered: 0, correct_count: 0 },
            recentActivity,
            reviewDue,
            wrongCount,
            progressPercent: totalQuestions > 0 ? Math.round((totalSeen / totalQuestions) * 100 * 10) / 10 : 0
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats/review - Smart review queue counts for user
router.get('/review', auth, (req, res) => {
    try {
        const starred = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND starred = 1').get(req.user.id).count;
        const wrong = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND times_seen > 0 AND times_correct < times_seen').get(req.user.id).count;
        const reviewDue = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND next_review_at IS NOT NULL AND next_review_at <= datetime("now")').get(req.user.id).count;
        const unseen = db.prepare('SELECT COUNT(*) as count FROM questions WHERE user_id = ? AND times_seen = 0').get(req.user.id).count;
        const recentlyCorrect = db.prepare(`
      SELECT COUNT(*) as count FROM questions
      WHERE user_id = ? AND times_correct > 0 AND last_seen_at >= datetime('now', '-3 days')
    `).get(req.user.id).count;

        res.json({ starred, wrong, reviewDue, unseen, recentlyCorrect });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function calculateStreak(userId) {
    const activities = db.prepare(`
    SELECT date FROM daily_activity_v2
    WHERE user_id = ? AND questions_answered > 0
    ORDER BY date DESC
  `).all(userId);

    if (activities.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < activities.length; i++) {
        const actDate = new Date(activities[i].date + 'T00:00:00');
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);

        if (actDate.getTime() === expectedDate.getTime()) {
            streak++;
        } else if (i === 0) {
            // Check if yesterday counts (user hasn't studied today yet)
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            if (actDate.getTime() === yesterday.getTime()) {
                streak++;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    return streak;
}

module.exports = router;
