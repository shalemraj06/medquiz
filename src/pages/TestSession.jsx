import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import LabValuesModal from '../components/LabValuesModal'

export default function TestSession({ addToast }) {
    const { sessionId } = useParams()
    const navigate = useNavigate()
    const [questions, setQuestions] = useState([])
    const [currentIdx, setCurrentIdx] = useState(0)
    const [answers, setAnswers] = useState({})
    const [revealed, setRevealed] = useState({})
    const [flagged, setFlagged] = useState({})
    const [eliminated, setEliminated] = useState({}) // { qId: [0, 2] }
    const [mode, setMode] = useState('tutor') // tutor, timed, untimed
    const [timeLimit, setTimeLimit] = useState(0)
    const [timeLeft, setTimeLeft] = useState(0)
    const [loading, setLoading] = useState(true)
    const [completing, setCompleting] = useState(false)
    const [explanations, setExplanations] = useState({})

    // Pro features state
    const [showLabValues, setShowLabValues] = useState(false)
    const [noteText, setNoteText] = useState('')
    const [savingNote, setSavingNote] = useState(false)
    const [highlights, setHighlights] = useState({}) // { qId: ['highlight 1', 'highlight 2'] }

    const startTimeRef = useRef(Date.now())
    const questionStartRef = useRef(Date.now())
    const qTextRef = useRef(null)

    useEffect(() => {
        api.startTest({ _sessionId: sessionId }).catch(() => null)

        const loadTest = async () => {
            try {
                const summary = await api.getTestSummary(sessionId)
                if (summary && summary.answers) {
                    const qs = summary.answers.map(a => ({
                        id: a.question_id,
                        question_text: a.question_text,
                        options: a.options,
                        correct_index: a.correct_index,
                        explanation: a.explanation,
                        starred: a.starred,
                        deck_name: a.deck_name,
                        subject_name: a.subject_name,
                    }))
                    setQuestions(qs)
                    setMode(summary.session.mode || 'tutor')
                    setTimeLimit(summary.session.time_limit)
                    if (summary.session.mode === 'timed') {
                        setTimeLeft(summary.session.time_limit)
                    }

                    // Restore flagged state
                    const initialFlags = {}
                    summary.answers.forEach(a => {
                        if (a.flagged) initialFlags[a.question_id] = true
                    })
                    setFlagged(initialFlags)
                }
            } catch (err) {
                addToast('Failed to load test', 'error')
            }
            setLoading(false)
        }
        loadTest()
    }, [sessionId])

    // Load notes when question changes
    useEffect(() => {
        const currentQ = questions[currentIdx]
        if (!currentQ) return

        api.getNote(currentQ.id).then(res => {
            setNoteText(res.note_text || '')
        }).catch(() => setNoteText(''))
    }, [currentIdx, questions])

    // Timer
    useEffect(() => {
        if (mode !== 'timed' || timeLeft <= 0) return
        const interval = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval)
                    handleComplete()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(interval)
    }, [mode]) // Do NOT depend on timeLeft here to prevent resets

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    const currentQ = questions[currentIdx]

    const handleSelectAnswer = async (optionIdx) => {
        if (answers[currentQ.id] !== undefined) return // Already answered

        const timeSpent = Math.round((Date.now() - questionStartRef.current) / 1000)
        setAnswers(prev => ({ ...prev, [currentQ.id]: optionIdx }))

        try {
            const result = await api.submitAnswer(sessionId, {
                question_id: currentQ.id,
                selected_index: optionIdx,
                time_spent: timeSpent,
                flagged: !!flagged[currentQ.id]
            })

            // Only reveal immediately if in Tutor mode or Untimed mode
            if (mode === 'tutor' || mode === 'untimed') {
                setRevealed(prev => ({ ...prev, [currentQ.id]: result }))
                if (result.explanation) {
                    setExplanations(prev => ({ ...prev, [currentQ.id]: result.explanation }))
                }
            }
        } catch (err) {
            addToast('Failed to submit answer', 'error')
        }
    }

    const toggleEliminate = (e, optionIdx) => {
        e.preventDefault() // prevent default right-click menu or trigger from button
        e.stopPropagation()
        if (answers[currentQ.id] !== undefined) return // Can't strike out after answering

        setEliminated(prev => {
            const qElims = prev[currentQ.id] || []
            if (qElims.includes(optionIdx)) {
                return { ...prev, [currentQ.id]: qElims.filter(i => i !== optionIdx) }
            } else {
                return { ...prev, [currentQ.id]: [...qElims, optionIdx] }
            }
        })
    }

    const handleFlag = () => {
        setFlagged(prev => ({ ...prev, [currentQ.id]: !prev[currentQ.id] }))
    }

    const handleStar = async () => {
        try {
            const newStarred = !currentQ.starred
            await api.updateQuestion(currentQ.id, { starred: newStarred })
            setQuestions(prev => prev.map((q, i) => i === currentIdx ? { ...q, starred: newStarred } : q))
        } catch (err) { addToast('Failed to star', 'error') }
    }

    const goTo = (idx) => {
        setCurrentIdx(idx)
        questionStartRef.current = Date.now()
    }

    const handleNext = () => {
        if (currentIdx < questions.length - 1) goTo(currentIdx + 1)
    }

    const handlePrev = () => {
        if (currentIdx > 0) goTo(currentIdx - 1)
    }

    const handleComplete = async () => {
        if (completing) return
        const answeredCount = Object.keys(answers).length
        if (answeredCount < questions.length) {
            if (!window.confirm(`You have ${questions.length - answeredCount} unanswered questions. Submit anyway?`)) return
        }
        setCompleting(true)
        try {
            await api.completeTest(sessionId)
            navigate(`/summary/${sessionId}`)
        } catch (err) {
            addToast('Failed to complete test', 'error')
            setCompleting(false)
        }
    }

    const handleSaveNote = async () => {
        setSavingNote(true)
        try {
            await api.saveNote(currentQ.id, noteText)
            addToast('Note saved!', 'success')
        } catch (err) {
            addToast('Failed to save note', 'error')
        }
        setSavingNote(false)
    }

    // Text Highlighting functionality
    const handleMouseUp = () => {
        const selection = window.getSelection()
        const text = selection.toString().trim()
        if (text && text.length > 2 && qTextRef.current && qTextRef.current.contains(selection.anchorNode)) {
            // Very simplified generic highlight feature for the UI preview
            // Real applications would use exact dom offsets. We will just find and replace in the string safely.
            setHighlights(prev => {
                const qHl = prev[currentQ.id] || []
                if (!qHl.includes(text)) {
                    return { ...prev, [currentQ.id]: [...qHl, text] }
                }
                return prev
            })
            selection.removeAllRanges()
        }
    }

    const clearHighlights = () => {
        setHighlights(prev => ({ ...prev, [currentQ.id]: [] }))
    }

    if (loading) return <div className="loading-spinner" />
    if (questions.length === 0) return <div className="empty-state"><h3>No questions loaded</h3><button className="btn btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button></div>

    const answeredCount = Object.keys(answers).length
    const result = revealed[currentQ.id]
    const qElims = eliminated[currentQ.id] || []
    const qHl = highlights[currentQ.id] || []

    // Render highlighted question text safely
    let highlightedText = currentQ.question_text
    qHl.forEach(hlt => {
        // Escape regex special chars in highlight text
        const safeHl = hlt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`(${safeHl})`, 'gi')
        highlightedText = highlightedText.replace(regex, '<mark class="pro-highlight">$1</mark>')
    })

    return (
        <div className="question-container" style={{ maxWidth: '900px', margin: '0 auto' }}>
            {showLabValues && <LabValuesModal onClose={() => setShowLabValues(false)} />}

            {/* Top Bar - Pro Style */}
            <div className="question-progress" style={{ background: 'var(--bg-card)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md) var(--radius-md) 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Leave test? Your progress will be saved.')) navigate('/') }}>✕ Suspend</button>
                    <div style={{ height: '24px', width: '1px', background: 'var(--border)' }}></div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Item {currentIdx + 1} of {questions.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setShowLabValues(true)}>
                        🔬 Lab Values
                    </button>
                    {mode === 'timed' && (
                        <div className={`timer ${timeLeft < 60 ? 'critical' : timeLeft < 300 ? 'warning' : ''}`} style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '1.2rem', margin: '0 1rem' }}>
                            {formatTime(timeLeft)}
                        </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={handleComplete} disabled={completing}>
                        {completing ? '⏳' : 'End Block'}
                    </button>
                </div>
            </div>

            <div style={{ border: '1px solid var(--border)', borderTop: 'none', background: 'var(--bg-main)', padding: '1.5rem', borderRadius: '0 0 var(--radius-md) var(--radius-md)' }}>
                {/* Pro Toolbar */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className={`btn btn-sm ${flagged[currentQ.id] ? 'btn-danger' : 'btn-ghost'}`} onClick={handleFlag} style={{ outline: flagged[currentQ.id] ? '2px solid var(--danger)' : 'none' }}>
                            🚩 Mark
                        </button>
                        <button className={`btn btn-sm ${currentQ.starred ? 'btn-warning' : 'btn-ghost'}`} onClick={handleStar}>
                            {currentQ.starred ? '⭐ Starred' : '☆ Star'}
                        </button>
                        {qHl.length > 0 && (
                            <button className="btn btn-sm btn-ghost" onClick={clearHighlights} style={{ color: 'var(--text-muted)' }}>
                                Clear Highlights
                            </button>
                        )}
                    </div>
                </div>

                {/* Question */}
                <div
                    className="question-text"
                    ref={qTextRef}
                    onMouseUp={handleMouseUp}
                    dangerouslySetInnerHTML={{ __html: highlightedText.replace(/\n/g, '<br/>') }}
                    style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem', userSelect: 'text', cursor: 'text' }}
                />

                {/* Options */}
                <div className="options-list">
                    {currentQ.options.map((opt, i) => {
                        let cls = ''
                        if (result) {
                            if (i === currentQ.correct_index) cls = 'correct'
                            else if (i === answers[currentQ.id] && i !== currentQ.correct_index) cls = 'incorrect'
                        } else if (answers[currentQ.id] === i) {
                            cls = 'selected'
                        }

                        const isEliminated = qElims.includes(i)

                        return (
                            <div key={i} style={{ display: 'flex', alignItems: 'stretch', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                {/* Strike-through toggle (Pro feature) */}
                                {!result && (
                                    <button
                                        onClick={(e) => toggleEliminate(e, i)}
                                        className="btn btn-ghost"
                                        style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isEliminated ? 'var(--danger)' : 'var(--text-muted)' }}
                                        title="Eliminate option"
                                    >
                                        {isEliminated ? '✕✕' : '✕'}
                                    </button>
                                )}
                                <button
                                    className={`option-btn ${cls}`}
                                    onClick={() => handleSelectAnswer(i)}
                                    disabled={answers[currentQ.id] !== undefined}
                                    style={{
                                        flex: 1,
                                        textDecoration: isEliminated && !result ? 'line-through' : 'none',
                                        opacity: isEliminated && !result ? 0.5 : 1,
                                        transition: 'all 0.2s ease',
                                        textAlign: 'left'
                                    }}
                                >
                                    <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                                    <span>{opt}</span>
                                </button>
                            </div>
                        )
                    })}
                </div>

                {/* Explanation Area */}
                {result && (
                    <div className="explanation-box" style={{ marginTop: '2rem', borderTop: '2px solid var(--border)', paddingTop: '1.5rem', borderRadius: 0, background: 'transparent' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem', color: result.is_correct ? 'var(--success)' : 'var(--danger)' }}>
                            {result.is_correct ? '✅ Your answer is correct' : '❌ Your answer is incorrect'}
                        </h4>
                        <div style={{ marginTop: '1rem', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: (explanations[currentQ.id] || currentQ.explanation || 'No explanation available.').replace(/\n/g, '<br/>') }} />

                        {/* Note taking panel */}
                        <div style={{ marginTop: '2rem', background: 'var(--bg-input)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                            <h5 style={{ margin: '0 0 0.5rem 0', display: 'flex', justifyContent: 'space-between' }}>
                                📝 Personal Notes
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>Saved securely</span>
                            </h5>
                            <textarea
                                className="textarea"
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                placeholder="Type your personal insights, mnemonics, or key takeaways for this question here..."
                                style={{ minHeight: '100px', fontSize: '0.9rem' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                                <button className="btn btn-primary btn-sm" onClick={handleSaveNote} disabled={savingNote}>
                                    {savingNote ? 'Saving...' : 'Save Note'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Navigation Grid */}
            <div style={{ background: 'var(--bg-card)', padding: '1rem', marginTop: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <button className="btn btn-outline" onClick={handlePrev} disabled={currentIdx === 0}>← Previous</button>
                    <button className="btn btn-primary" onClick={handleNext} disabled={currentIdx === questions.length - 1}>Next Item →</button>
                </div>

                <div className="question-nav" style={{ justifyContent: 'flex-start' }}>
                    {questions.map((q, i) => {
                        let cls = ''
                        if (i === currentIdx) cls = 'current'
                        else if (revealed[q.id]?.is_correct) cls = 'correct'
                        else if (revealed[q.id] && !revealed[q.id].is_correct) cls = 'wrong'
                        else if (answers[q.id] !== undefined) cls = 'answered'
                        if (flagged[q.id]) cls += ' flagged'

                        return (
                            <div key={i} className={`question-nav-dot ${cls}`} onClick={() => goTo(i)} style={{ position: 'relative' }}>
                                {i + 1}
                                {flagged[q.id] && <span style={{ position: 'absolute', top: -5, right: -5, fontSize: '0.7rem' }}>🚩</span>}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
