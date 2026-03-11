const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/stats/dashboard - Overall dashboard stats for the user
router.get('/dashboard', auth, async (req, res) => {
    try {
        const totalQuestions = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1', [req.user.id])).rows[0].count, 10);
        const totalSeen = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1 AND times_seen > 0', [req.user.id])).rows[0].count, 10);
        const totalStarred = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1 AND starred = 1', [req.user.id])).rows[0].count, 10);
        const totalSubjects = parseInt((await db.query('SELECT COUNT(*) as count FROM subjects WHERE user_id = $1', [req.user.id])).rows[0].count, 10);
        const totalDecks = parseInt((await db.query('SELECT COUNT(*) as count FROM decks WHERE user_id = $1', [req.user.id])).rows[0].count, 10);

        // Completed sessions stats
        const sessionsRes = await db.query('SELECT * FROM test_sessions WHERE completed = 1 AND user_id = $1', [req.user.id]);
        const sessions = sessionsRes.rows;
        const completedTests = sessions.length;
        const avgScore = sessions.length > 0
            ? Math.round(sessions.reduce((sum, s) => sum + s.score_percent, 0) / sessions.length * 10) / 10
            : 0;

        // Daily streak calculation
        const streak = await calculateStreak(req.user.id);

        // Today's activity
        const today = new Date().toISOString().split('T')[0];
        const todayActivityRes = await db.query('SELECT * FROM daily_activity_v2 WHERE user_id = $1 AND date = $2', [req.user.id, today]);
        const todayActivity = todayActivityRes.rows[0];

        // Recent activity (last 7 days)
        const recentActivityRes = await db.query(`
      SELECT * FROM daily_activity_v2
      WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
      ORDER BY date DESC
    `, [req.user.id]);
        const recentActivity = recentActivityRes.rows;

        // Questions due for review
        const reviewDue = parseInt((await db.query(`
      SELECT COUNT(*) as count FROM questions
      WHERE user_id = $1 AND next_review_at IS NOT NULL AND next_review_at <= NOW()
    `, [req.user.id])).rows[0].count, 10);

        // Wrong answers count (questions answered wrong at least once)
        const wrongCount = parseInt((await db.query(`
      SELECT COUNT(*) as count FROM questions
      WHERE user_id = $1 AND times_seen > 0 AND times_correct < times_seen
    `, [req.user.id])).rows[0].count, 10);

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
router.get('/review', auth, async (req, res) => {
    try {
        const starred = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1 AND starred = 1', [req.user.id])).rows[0].count, 10);
        const wrong = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1 AND times_seen > 0 AND times_correct < times_seen', [req.user.id])).rows[0].count, 10);
        const reviewDue = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1 AND next_review_at IS NOT NULL AND next_review_at <= NOW()', [req.user.id])).rows[0].count, 10);
        const unseen = parseInt((await db.query('SELECT COUNT(*) as count FROM questions WHERE user_id = $1 AND times_seen = 0', [req.user.id])).rows[0].count, 10);
        const recentlyCorrect = parseInt((await db.query(`
      SELECT COUNT(*) as count FROM questions
      WHERE user_id = $1 AND times_correct > 0 AND last_seen_at >= NOW() - INTERVAL '3 days'
    `, [req.user.id])).rows[0].count, 10);

        res.json({ starred, wrong, reviewDue, unseen, recentlyCorrect });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

async function calculateStreak(userId) {
    const activitiesRes = await db.query(`
    SELECT date FROM daily_activity_v2
    WHERE user_id = $1 AND questions_answered > 0
    ORDER BY date DESC
  `, [userId]);
    const activities = activitiesRes.rows;

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
