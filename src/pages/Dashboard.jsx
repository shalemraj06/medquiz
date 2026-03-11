import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import ImportPanel from '../components/ImportPanel'

export default function Dashboard({ addToast }) {
    const navigate = useNavigate()
    const [stats, setStats] = useState(null)
    const [subjects, setSubjects] = useState([])
    const [showNewSubject, setShowNewSubject] = useState(false)
    const [newSubject, setNewSubject] = useState({ name: '', description: '', color: '#3b82f6', icon: '📚' })
    const [showTestConfig, setShowTestConfig] = useState(false)
    const [testConfig, setTestConfig] = useState({ questionCount: 20, mode: 'untimed', timeLimit: 30, subjectIds: [], deckIds: [], filterType: 'all' })

    const loadData = () => {
        api.getDashboardStats().then(setStats).catch(() => addToast('Failed to load stats', 'error'))
        api.getSubjects().then(setSubjects).catch(() => { })
    }

    useEffect(() => { loadData() }, [])

    const handleCreateSubject = async () => {
        if (!newSubject.name.trim()) return addToast('Subject name required', 'error')
        try {
            await api.createSubject(newSubject)
            setNewSubject({ name: '', description: '', color: '#3b82f6', icon: '📚' })
            setShowNewSubject(false)
            loadData()
            addToast('Subject created!', 'success')
        } catch (err) { addToast(err.message, 'error') }
    }

    const handleStartTest = async () => {
        try {
            const data = await api.startTest({
                subjectIds: testConfig.subjectIds.length > 0 ? testConfig.subjectIds : undefined,
                deckIds: testConfig.deckIds.length > 0 ? testConfig.deckIds : undefined,
                questionCount: testConfig.questionCount,
                mode: testConfig.mode,
                timeLimit: testConfig.mode === 'timed' ? testConfig.timeLimit * 60 : 0,
                filterType: testConfig.filterType !== 'all' ? testConfig.filterType : undefined
            })
            navigate(`/test/${data.sessionId}`)
        } catch (err) { addToast(err.message, 'error') }
    }

    const handleDeleteSubject = async (id, e) => {
        e.stopPropagation()
        if (!confirm('Delete this subject and all its decks/questions?')) return
        try {
            await api.deleteSubject(id)
            loadData()
            addToast('Subject deleted', 'success')
        } catch (err) { addToast(err.message, 'error') }
    }

    const iconOptions = ['📚', '🧠', '❤️', '🫁', '🦴', '💊', '🔬', '🧬', '🩺', '🏥', '👶', '🤰', '🦷', '👁️', '🧪']
    const colorOptions = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']

    if (!stats) return <div className="loading-spinner" />

    return (
        <div>
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>Welcome back! Track your progress and start studying.</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card blue">
                    <div className="stat-card-icon">📝</div>
                    <div className="stat-card-value">{stats.totalQuestions}</div>
                    <div className="stat-card-label">Total Questions</div>
                </div>
                <div className="stat-card emerald">
                    <div className="stat-card-icon">✅</div>
                    <div className="stat-card-value">{stats.completedTests}</div>
                    <div className="stat-card-label">Tests Completed</div>
                </div>
                <div className="stat-card amber">
                    <div className="stat-card-icon">📈</div>
                    <div className="stat-card-value">{stats.avgScore}%</div>
                    <div className="stat-card-label">Average Score</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-card-icon">🔥</div>
                    <div className="stat-card-value">{stats.streak}</div>
                    <div className="stat-card-label">Day Streak</div>
                </div>
                <div className="stat-card coral">
                    <div className="stat-card-icon">🔄</div>
                    <div className="stat-card-value">{stats.reviewDue}</div>
                    <div className="stat-card-label">Due for Review</div>
                </div>
            </div>

            {/* Overall Progress */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Overall Progress</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{stats.totalSeen} / {stats.totalQuestions} questions seen ({stats.progressPercent}%)</span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill emerald" style={{ width: `${stats.progressPercent}%` }} />
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-lg" onClick={() => setShowTestConfig(true)} disabled={stats.totalQuestions === 0}>
                    🚀 Start Test
                </button>
                <button className="btn btn-outline" onClick={() => setShowNewSubject(true)}>
                    ➕ New Subject
                </button>
                <button className="btn btn-outline" onClick={() => navigate('/review?filter=starred')} disabled={stats.totalStarred === 0}>
                    ⭐ Starred ({stats.totalStarred})
                </button>
                <button className="btn btn-outline" onClick={() => navigate('/review?filter=wrong')} disabled={stats.wrongCount === 0}>
                    ❌ Wrong ({stats.wrongCount})
                </button>
            </div>

            {/* Subjects Grid */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Subjects</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subjects.length} subjects</span>
            </div>

            {subjects.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">📚</div>
                    <h3>No Subjects Yet</h3>
                    <p>Create your first subject to start organizing your medical questions.</p>
                    <button className="btn btn-primary" onClick={() => setShowNewSubject(true)}>Create Subject</button>
                </div>
            ) : (
                <div className="card-grid">
                    {subjects.map(s => (
                        <div key={s.id} className="subject-card" onClick={() => navigate(`/subject/${s.id}`)}>
                            <div className="subject-card-header">
                                <div className="subject-card-icon" style={{ background: `${s.color}20` }}>{s.icon}</div>
                                <div>
                                    <div className="subject-card-title">{s.name}</div>
                                    <div className="subject-card-subtitle">{s.description || 'No description'}</div>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={(e) => handleDeleteSubject(s.id, e)} title="Delete" style={{ marginLeft: 'auto' }}>🗑️</button>
                            </div>
                            <div className="progress-bar" style={{ marginBottom: '0.5rem' }}>
                                <div className="progress-bar-fill" style={{ width: `${s.question_count > 0 ? (s.seen_count / s.question_count * 100) : 0}%`, background: s.color }} />
                            </div>
                            <div className="subject-card-stats">
                                <span>📦 {s.deck_count} decks</span>
                                <span>📝 {s.question_count} questions</span>
                                <span>👁️ {s.seen_count} seen</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Import Panel - directly below subjects */}
            <ImportPanel addToast={addToast} onImportComplete={loadData} />

            {/* New Subject Modal */}
            {showNewSubject && (
                <div className="modal-overlay" onClick={() => setShowNewSubject(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Subject</h3>
                            <button className="btn btn-ghost" onClick={() => setShowNewSubject(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Subject Name</label>
                                <input className="input" value={newSubject.name} onChange={e => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="e.g. Anatomy, Pharmacology" autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <input className="input" value={newSubject.description} onChange={e => setNewSubject({ ...newSubject, description: e.target.value })} placeholder="Optional description" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Icon</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {iconOptions.map(icon => (
                                        <button key={icon} className={`btn btn-ghost ${newSubject.icon === icon ? 'active' : ''}`}
                                            style={{ fontSize: '1.25rem', padding: '0.5rem', border: newSubject.icon === icon ? '2px solid var(--accent-blue)' : '1px solid var(--border)', borderRadius: '8px' }}
                                            onClick={() => setNewSubject({ ...newSubject, icon })}>
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Color</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {colorOptions.map(color => (
                                        <button key={color} style={{ width: 32, height: 32, borderRadius: 8, background: color, border: newSubject.color === color ? '3px solid white' : '2px solid transparent', cursor: 'pointer' }}
                                            onClick={() => setNewSubject({ ...newSubject, color })} />
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowNewSubject(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateSubject}>Create Subject</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Config Modal */}
            {showTestConfig && (
                <div className="modal-overlay" onClick={() => setShowTestConfig(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🚀 Start a Test</h3>
                            <button className="btn btn-ghost" onClick={() => setShowTestConfig(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Number of Questions</label>
                                <input className="input" type="number" min="1" max="200" value={testConfig.questionCount}
                                    onChange={e => setTestConfig({ ...testConfig, questionCount: parseInt(e.target.value) || 10 })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subjects (leave empty for all)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {subjects.map(s => (
                                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            <input type="checkbox" checked={testConfig.subjectIds.includes(s.id)}
                                                onChange={() => {
                                                    const ids = testConfig.subjectIds.includes(s.id)
                                                        ? testConfig.subjectIds.filter(x => x !== s.id)
                                                        : [...testConfig.subjectIds, s.id]
                                                    setTestConfig({ ...testConfig, subjectIds: ids })
                                                }} />
                                            {s.icon} {s.name} ({s.question_count})
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Filter Type</label>
                                <select className="select" value={testConfig.filterType} onChange={e => setTestConfig({ ...testConfig, filterType: e.target.value })}>
                                    <option value="all">All Questions</option>
                                    <option value="unseen">Unseen Only</option>
                                    <option value="wrong">Wrong Answers Only</option>
                                    <option value="starred">Starred Only</option>
                                    <option value="review">Due for Review</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Mode</label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className={`btn ${testConfig.mode === 'untimed' ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setTestConfig({ ...testConfig, mode: 'untimed' })}>
                                        Untimed
                                    </button>
                                    <button className={`btn ${testConfig.mode === 'timed' ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setTestConfig({ ...testConfig, mode: 'timed' })}>
                                        ⏱️ Timed
                                    </button>
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
                            <button className="btn btn-success btn-lg" onClick={handleStartTest}>
                                🚀 Start Test
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
