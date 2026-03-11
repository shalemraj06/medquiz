import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import ImportPanel from '../components/ImportPanel'

export default function SubjectView({ addToast }) {
    const { id } = useParams()
    const navigate = useNavigate()
    const [subject, setSubject] = useState(null)
    const [decks, setDecks] = useState([])
    const [showNewDeck, setShowNewDeck] = useState(false)
    const [newDeckName, setNewDeckName] = useState('')
    const [newDeckDesc, setNewDeckDesc] = useState('')
    const [showTestConfig, setShowTestConfig] = useState(false)
    const [testConfig, setTestConfig] = useState({ questionCount: 20, mode: 'untimed', timeLimit: 30, deckIds: [], filterType: 'all' })

    const loadData = () => {
        api.getSubject(id).then(setSubject).catch(() => addToast('Subject not found', 'error'))
        api.getDecks(id).then(setDecks).catch(() => { })
    }
    useEffect(() => { loadData() }, [id])

    const handleCreateDeck = async () => {
        if (!newDeckName.trim()) return addToast('Deck name required', 'error')
        try {
            await api.createDeck({ name: newDeckName, description: newDeckDesc, subject_id: parseInt(id) })
            setNewDeckName(''); setNewDeckDesc(''); setShowNewDeck(false)
            loadData()
            addToast('Deck created!', 'success')
        } catch (err) { addToast(err.message, 'error') }
    }

    const handleResetDeck = async (deckId, deckName) => {
        if (!confirm(`Reset all progress for "${deckName}"? This cannot be undone.`)) return
        try {
            await api.resetDeck(deckId)
            loadData()
            addToast(`"${deckName}" reset to new`, 'success')
        } catch (err) { addToast(err.message, 'error') }
    }

    const handleDeleteDeck = async (deckId) => {
        if (!confirm('Delete this deck and all its questions?')) return
        try {
            await api.deleteDeck(deckId)
            loadData()
            addToast('Deck deleted', 'success')
        } catch (err) { addToast(err.message, 'error') }
    }

    const handleStartTest = async () => {
        try {
            const cfg = {
                deckIds: testConfig.deckIds.length > 0 ? testConfig.deckIds : decks.map(d => d.id),
                questionCount: testConfig.questionCount,
                mode: testConfig.mode,
                timeLimit: testConfig.mode === 'timed' ? testConfig.timeLimit * 60 : 0,
                filterType: testConfig.filterType !== 'all' ? testConfig.filterType : undefined,
                name: subject ? `${subject.name} Test` : 'Test'
            }
            const data = await api.startTest(cfg)
            navigate(`/test/${data.sessionId}`)
        } catch (err) { addToast(err.message, 'error') }
    }

    if (!subject) return <div className="loading-spinner" />

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button className="btn btn-ghost" onClick={() => navigate('/')}>← Back</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 'var(--radius-md)', background: `${subject.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                        {subject.icon}
                    </div>
                    <div>
                        <h2>{subject.name}</h2>
                        <p>{subject.description || 'No description'} • {subject.question_count} questions • {subject.deck_count} decks</p>
                    </div>
                </div>
                <div className="page-header-actions">
                    <button className="btn btn-primary" onClick={() => setShowTestConfig(true)} disabled={subject.question_count === 0}>🚀 Start Test</button>
                    <button className="btn btn-outline" onClick={() => setShowNewDeck(true)}>➕ New Deck</button>
                </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Progress</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {subject.seen_count} / {subject.question_count} ({subject.question_count > 0 ? Math.round(subject.seen_count / subject.question_count * 100) : 0}%)
                    </span>
                </div>
                <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${subject.question_count > 0 ? (subject.seen_count / subject.question_count * 100) : 0}%`, background: subject.color }} />
                </div>
            </div>

            {/* Decks */}
            <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 700 }}>Decks</h3>
            {decks.length === 0 ? (
                <div className="empty-state">
                    <div className="icon">📦</div>
                    <h3>No Decks Yet</h3>
                    <p>Create a deck to organize questions within this subject.</p>
                    <button className="btn btn-primary" onClick={() => setShowNewDeck(true)}>Create Deck</button>
                </div>
            ) : (
                <div className="card-grid">
                    {decks.map(d => (
                        <div key={d.id} className="deck-card">
                            <div className="deck-card-header">
                                <div className="deck-card-title">{d.name}</div>
                                <div className="deck-card-actions">
                                    <button className="btn btn-ghost btn-sm" title="Reset Progress" onClick={() => handleResetDeck(d.id, d.name)}>🔄</button>
                                    <button className="btn btn-ghost btn-sm" title="Delete Deck" onClick={() => handleDeleteDeck(d.id)}>🗑️</button>
                                </div>
                            </div>
                            <div className="deck-card-stats">
                                <span>📝 {d.question_count} questions</span>
                                <span>👁️ {d.seen_count} seen</span>
                                <span>⭐ {d.starred_count} starred</span>
                            </div>
                            <div className="progress-bar">
                                <div className="progress-bar-fill" style={{ width: `${d.progress_percent || 0}%`, background: d.subject_color || 'var(--accent-blue)' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.progress_percent || 0}% complete</span>
                                <button className="btn btn-sm btn-outline" onClick={() => {
                                    setTestConfig({ ...testConfig, deckIds: [d.id] })
                                    setShowTestConfig(true)
                                }} disabled={d.question_count === 0}>
                                    Start
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Import Panel for this subject */}
            <ImportPanel addToast={addToast} onImportComplete={loadData} preselectedSubjectId={parseInt(id)} />

            {/* New Deck Modal */}
            {showNewDeck && (
                <div className="modal-overlay" onClick={() => setShowNewDeck(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>New Deck in {subject.name}</h3>
                            <button className="btn btn-ghost" onClick={() => setShowNewDeck(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Deck Name</label>
                                <input className="input" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="e.g. Block 1, Chapter 5" autoFocus />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description (optional)</label>
                                <input className="input" value={newDeckDesc} onChange={e => setNewDeckDesc(e.target.value)} placeholder="Optional description" />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-outline" onClick={() => setShowNewDeck(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreateDeck}>Create Deck</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Test Config Modal */}
            {showTestConfig && (
                <div className="modal-overlay" onClick={() => setShowTestConfig(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🚀 Start Test: {subject.name}</h3>
                            <button className="btn btn-ghost" onClick={() => setShowTestConfig(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Number of Questions</label>
                                <input className="input" type="number" min="1" max="200" value={testConfig.questionCount}
                                    onChange={e => setTestConfig({ ...testConfig, questionCount: parseInt(e.target.value) || 10 })} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Decks (leave empty for all)</label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {decks.map(d => (
                                        <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                            <input type="checkbox" checked={testConfig.deckIds.includes(d.id)}
                                                onChange={() => {
                                                    const ids = testConfig.deckIds.includes(d.id)
                                                        ? testConfig.deckIds.filter(x => x !== d.id)
                                                        : [...testConfig.deckIds, d.id]
                                                    setTestConfig({ ...testConfig, deckIds: ids })
                                                }} />
                                            {d.name} ({d.question_count})
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Filter</label>
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
                                    <button className={`btn ${testConfig.mode === 'untimed' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTestConfig({ ...testConfig, mode: 'untimed' })}>Untimed</button>
                                    <button className={`btn ${testConfig.mode === 'timed' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTestConfig({ ...testConfig, mode: 'timed' })}>⏱️ Timed</button>
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
                            <button className="btn btn-success btn-lg" onClick={handleStartTest}>🚀 Start</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
