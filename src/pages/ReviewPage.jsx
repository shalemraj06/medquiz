import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../utils/api'

export default function ReviewPage({ addToast }) {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const [activeTab, setActiveTab] = useState(searchParams.get('filter') || 'starred')
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [reviewStats, setReviewStats] = useState({})
    const [showTestConfig, setShowTestConfig] = useState(false)
    const [testConfig, setTestConfig] = useState({ questionCount: 20, mode: 'untimed', timeLimit: 30 })

    const tabs = [
        { id: 'starred', label: '⭐ Starred', param: { starred: '1' } },
        { id: 'wrong', label: '❌ Wrong', param: { wrong: '1' } },
        { id: 'review', label: '🔄 Spaced Review', param: { review: '1' } },
    ]

    const loadQuestions = async (tab) => {
        setLoading(true)
        try {
            const tabConfig = tabs.find(t => t.id === tab)
            const qs = await api.getQuestions(tabConfig?.param || {})
            setQuestions(qs)
        } catch (err) {
            addToast('Failed to load questions', 'error')
        }
        setLoading(false)
    }

    useEffect(() => {
        api.getReviewStats().then(setReviewStats).catch(() => { })
        loadQuestions(activeTab)
    }, [activeTab])

    const handleTabChange = (tab) => {
        setActiveTab(tab)
    }

    const handleToggleStar = async (qId, currentStarred) => {
        try {
            await api.updateQuestion(qId, { starred: !currentStarred })
            setQuestions(prev => prev.map(q => q.id === qId ? { ...q, starred: q.starred ? 0 : 1 } : q))
            if (activeTab === 'starred' && currentStarred) {
                setQuestions(prev => prev.filter(q => q.id !== qId))
            }
        } catch (err) { addToast('Failed to update', 'error') }
    }

    const handleStartReview = async () => {
        try {
            const data = await api.startTest({
                questionCount: testConfig.questionCount,
                mode: testConfig.mode,
                timeLimit: testConfig.mode === 'timed' ? testConfig.timeLimit * 60 : 0,
                filterType: activeTab,
                name: `Review: ${activeTab === 'starred' ? 'Starred' : activeTab === 'wrong' ? 'Wrong Answers' : 'Spaced Review'}`
            })
            navigate(`/test/${data.sessionId}`)
        } catch (err) { addToast(err.message, 'error') }
    }

    return (
        <div>
            <div className="page-header">
                <h2>Smart Review</h2>
                <p>Review questions strategically with spaced repetition, starred items, and wrong answers.</p>
            </div>

            {/* Tabs */}
            <div className="tabs">
                {tabs.map(tab => (
                    <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => handleTabChange(tab.id)}>
                        {tab.label}
                        {reviewStats[tab.id] > 0 && <span className="count">{reviewStats[tab.id]}</span>}
                    </button>
                ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <button className="btn btn-primary" onClick={() => setShowTestConfig(true)} disabled={questions.length === 0}>
                    🚀 Start Review Test ({questions.length})
                </button>
            </div>

            {/* Questions List */}
            {loading ? (
                <div className="loading-spinner" />
            ) : questions.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">{activeTab === 'starred' ? '⭐' : activeTab === 'wrong' ? '❌' : '🔄'}</div>
                    <h3>No Questions</h3>
                    <p>
                        {activeTab === 'starred' ? 'Star questions during tests to find them here.' :
                            activeTab === 'wrong' ? 'Questions you answer incorrectly will appear here.' :
                                'Questions due for spaced repetition review will appear here.'}
                    </p>
                    <button className="btn btn-outline" onClick={() => navigate('/')}>Go to Dashboard</button>
                </div>
            ) : (
                <div>
                    {questions.map((q, idx) => (
                        <div key={q.id} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)', padding: '1rem', marginBottom: '0.5rem',
                            transition: 'var(--transition-fast)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                                        <span className="pill blue">{q.subject_name}</span>
                                        <span className="pill purple">{q.deck_name}</span>
                                        {q.times_seen > 0 && (
                                            <span className={`pill ${q.times_correct === q.times_seen ? 'emerald' : 'coral'}`}>
                                                {q.times_correct}/{q.times_seen} correct
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.35rem' }}>
                                        {q.question_text.length > 150 ? q.question_text.slice(0, 150) + '...' : q.question_text}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        {q.options.map((opt, j) => (
                                            <span key={j} style={{ marginRight: '0.75rem', color: j === q.correct_index ? 'var(--accent-emerald)' : undefined }}>
                                                {String.fromCharCode(65 + j)}) {opt.length > 30 ? opt.slice(0, 30) + '...' : opt}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <button className="btn btn-ghost" onClick={() => handleToggleStar(q.id, q.starred)} title={q.starred ? 'Unstar' : 'Star'}>
                                    {q.starred ? '⭐' : '☆'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Test Config Modal */}
            {showTestConfig && (
                <div className="modal-overlay" onClick={() => setShowTestConfig(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🚀 Start Review Test</h3>
                            <button className="btn btn-ghost" onClick={() => setShowTestConfig(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Number of Questions (max {questions.length})</label>
                                <input className="input" type="number" min="1" max={questions.length}
                                    value={Math.min(testConfig.questionCount, questions.length)}
                                    onChange={e => setTestConfig({ ...testConfig, questionCount: parseInt(e.target.value) || 10 })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mode</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className={`btn ${testConfig.mode === 'untimed' ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setTestConfig({ ...testConfig, mode: 'untimed' })}>Untimed</button>
                                    <button className={`btn ${testConfig.mode === 'timed' ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setTestConfig({ ...testConfig, mode: 'timed' })}>⏱️ Timed</button>
                                </div>
                            </div>
                            {testConfig.mode === 'timed' && (
                                <div className="form-group">
                                    <label className="form-label">Time Limit (minutes)</label>
                                    <input className="input" type="number" min="1" max="180" value={testConfig.timeLimit}
                                        onChange={e => setTestConfig({ ...testConfig, timeLimit: parseInt(e.target.value) || 30 })} />
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowTestConfig(false)}>Cancel</button>
                            <button className="btn btn-success btn-lg" onClick={handleStartReview}>🚀 Start</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
