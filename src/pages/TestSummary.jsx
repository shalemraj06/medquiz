import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'

export default function TestSummary({ addToast }) {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const [data, setData] = useState(null)
    const [showDetails, setShowDetails] = useState(false)

    useEffect(() => {
        api.getTestSummary(sessionId)
            .then(setData)
            .catch(() => addToast('Failed to load summary', 'error'))
    }, [sessionId])

    if (!data) return <div className="loading-spinner" />

    const { session, answers, analytics } = data
    const score = session.score_percent
    const scoreClass = score >= 80 ? 'good' : score >= 50 ? 'okay' : 'poor'
    const circumference = 2 * Math.PI * 70
    const correctDash = (session.correct_count / session.total_questions) * circumference
    const wrongDash = (session.wrong_count / session.total_questions) * circumference

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <button className="btn btn-ghost" onClick={() => navigate('/')}>← Dashboard</button>
            </div>

            {/* Score Header */}
            <div className="summary-header">
                <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Test Complete</h2>

                {/* Donut Chart */}
                <div className="summary-donut">
                    <svg viewBox="0 0 160 160">
                        <circle cx="80" cy="80" r="70" fill="none" stroke="var(--border)" strokeWidth="12" />
                        <circle cx="80" cy="80" r="70" fill="none"
                            stroke={score >= 80 ? 'var(--accent-emerald)' : score >= 50 ? 'var(--accent-amber)' : 'var(--accent-coral)'}
                            strokeWidth="12" strokeDasharray={`${correctDash} ${circumference}`}
                            strokeLinecap="round" />
                    </svg>
                    <div className="summary-donut-label">
                        <div className={`summary-score ${scoreClass}`}>{Math.round(score)}%</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Score</div>
                    </div>
                </div>

                <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    {score >= 90 ? '🎉 Outstanding! You crushed it!' :
                        score >= 80 ? '🌟 Great job! Strong performance!' :
                            score >= 70 ? '👍 Good work! Keep improving!' :
                                score >= 50 ? '📈 Room for improvement. Review your weak areas.' :
                                    '💪 Keep studying. Focus on the topics you missed.'}
                </p>
            </div>

            {/* Breakdown Cards */}
            <div className="summary-breakdown">
                <div className="summary-breakdown-item">
                    <div className="value" style={{ color: 'var(--accent-emerald)' }}>{session.correct_count}</div>
                    <div className="label">Correct</div>
                </div>
                <div className="summary-breakdown-item">
                    <div className="value" style={{ color: 'var(--accent-coral)' }}>{session.wrong_count}</div>
                    <div className="label">Wrong</div>
                </div>
                <div className="summary-breakdown-item">
                    <div className="value">{session.total_questions}</div>
                    <div className="label">Total</div>
                </div>
                <div className="summary-breakdown-item">
                    <div className="value">{analytics.flaggedCount}</div>
                    <div className="label">Flagged</div>
                </div>
                <div className="summary-breakdown-item">
                    <div className="value">{analytics.avgTimePerQuestion}s</div>
                    <div className="label">Avg Time / Q</div>
                </div>
                <div className="summary-breakdown-item">
                    <div className="value">{Math.round(analytics.totalTime / 60)}m</div>
                    <div className="label">Total Time</div>
                </div>
            </div>

            {/* Subject Performance */}
            {Object.keys(analytics.subjectPerformance).length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>📊 Performance by Subject</h3>
                    {Object.entries(analytics.subjectPerformance).map(([name, perf]) => {
                        const pct = perf.total > 0 ? Math.round((perf.correct / perf.total) * 100) : 0
                        return (
                            <div key={name} style={{ marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{name}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                        {perf.correct}/{perf.total} ({pct}%)
                                    </span>
                                </div>
                                <div className="progress-bar">
                                    <div className={`progress-bar-fill ${pct >= 80 ? 'emerald' : pct >= 50 ? 'amber' : 'coral'}`}
                                        style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Deck Performance */}
            {Object.keys(analytics.deckPerformance).length > 1 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>📦 Performance by Deck</h3>
                    {Object.entries(analytics.deckPerformance).map(([name, perf]) => {
                        const pct = perf.total > 0 ? Math.round((perf.correct / perf.total) * 100) : 0
                        return (
                            <div key={name} style={{ marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{name}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{perf.correct}/{perf.total} ({pct}%)</span>
                                </div>
                                <div className="progress-bar">
                                    <div className={`progress-bar-fill ${pct >= 80 ? 'emerald' : pct >= 50 ? 'amber' : 'coral'}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
                <button className="btn btn-primary" onClick={() => navigate('/')}>🏠 Dashboard</button>
                <button className="btn btn-outline" onClick={() => navigate('/review?filter=wrong')}>
                    ❌ Review Wrong ({session.wrong_count})
                </button>
                <button className="btn btn-outline" onClick={() => setShowDetails(!showDetails)}>
                    {showDetails ? '🔼 Hide Details' : '🔽 Show All Questions'}
                </button>
            </div>

            {/* Detailed Question Review */}
            {showDetails && (
                <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem' }}>📝 Question Review</h3>
                    {answers.map((a, idx) => (
                        <div key={a.id} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '0.75rem',
                            borderLeft: `3px solid ${a.is_correct ? 'var(--accent-emerald)' : 'var(--accent-coral)'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: a.is_correct ? 'var(--accent-emerald)' : 'var(--accent-coral)' }}>
                                    Q{idx + 1} • {a.is_correct ? '✓ Correct' : '✕ Wrong'}
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.subject_name} → {a.deck_name}</span>
                            </div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>{a.question_text}</div>
                            <div style={{ fontSize: '0.8rem' }}>
                                {a.options.map((opt, j) => (
                                    <div key={j} style={{
                                        padding: '0.25rem 0',
                                        color: j === a.correct_index ? 'var(--accent-emerald)' :
                                            j === a.selected_index && !a.is_correct ? 'var(--accent-coral)' : 'var(--text-secondary)',
                                        fontWeight: j === a.correct_index ? 600 : 400
                                    }}>
                                        {String.fromCharCode(65 + j)}) {opt}
                                        {j === a.correct_index && ' ✓'}
                                        {j === a.selected_index && j !== a.correct_index && ' ✕ (your answer)'}
                                    </div>
                                ))}
                            </div>
                            {a.explanation && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                                    {a.explanation}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
