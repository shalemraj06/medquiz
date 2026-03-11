import { useState, useEffect, useRef } from 'react'
import { api } from '../utils/api'

export default function ImportPanel({ addToast, onImportComplete, preselectedSubjectId, preselectedDeckId }) {
    const [expanded, setExpanded] = useState(false)
    const [importMode, setImportMode] = useState('text') // 'text' or 'file'
    const [rawInput, setRawInput] = useState('')
    const [selectedFile, setSelectedFile] = useState(null)
    const [isDragging, setIsDragging] = useState(false)
    const fileInputRef = useRef(null)

    const [parsing, setParsing] = useState(false)
    const [parsed, setParsed] = useState(null)
    const [saving, setSaving] = useState(false)

    // Save config
    const [targetMode, setTargetMode] = useState('existing') // existing, new_deck, new_both
    const [selectedDeckId, setSelectedDeckId] = useState(preselectedDeckId || '')
    const [selectedSubjectId, setSelectedSubjectId] = useState(preselectedSubjectId || '')
    const [newDeckName, setNewDeckName] = useState('')
    const [newSubjectName, setNewSubjectName] = useState('')
    const [newSubjectColor, setNewSubjectColor] = useState('#3b82f6')

    useEffect(() => {
        if (preselectedSubjectId) setSelectedSubjectId(preselectedSubjectId)
        if (preselectedDeckId) setSelectedDeckId(preselectedDeckId)
    }, [preselectedSubjectId, preselectedDeckId])

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    }

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    }

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) {
            setSelectedFile(file);
            setImportMode('file');
        }
    }

    const handleParse = async () => {
        setParsing(true)
        try {
            let result;
            if (importMode === 'text') {
                if (!rawInput.trim()) {
                    setParsing(false);
                    return addToast('Please enter some questions to parse', 'error');
                }
                result = await api.parseImport(rawInput);
            } else {
                if (!selectedFile) {
                    setParsing(false);
                    return addToast('Please select a file to parse', 'error');
                }
                result = await api.parseImportFile(selectedFile);
            }

            setParsed(result)
            addToast(`Parsed ${result.totalParsed} questions!`, 'success')

            // Auto-select subject suggestion
            if (result.subjectSuggestions?.length > 0) {
                const match = result.existingSubjects.find(s => s.name === result.subjectSuggestions[0].name)
                if (match) setSelectedSubjectId(match.id)
            }
        } catch (err) {
            addToast(err.message, 'error')
        }
        setParsing(false)
    }

    const handleSave = async () => {
        if (!parsed) return
        setSaving(true)
        try {
            const payload = {
                questions: parsed.questions,
            }

            if (targetMode === 'existing') {
                if (!selectedDeckId) return addToast('Select a deck', 'error')
                payload.deck_id = parseInt(selectedDeckId)
            } else if (targetMode === 'new_deck') {
                if (!newDeckName.trim()) return addToast('Enter deck name', 'error')
                if (!selectedSubjectId) return addToast('Select a subject', 'error')
                payload.new_deck_name = newDeckName
                payload.subject_id = parseInt(selectedSubjectId)
            } else {
                if (!newSubjectName.trim()) return addToast('Enter subject name', 'error')
                if (!newDeckName.trim()) return addToast('Enter deck name', 'error')
                payload.new_subject_name = newSubjectName
                payload.new_subject_color = newSubjectColor
                payload.new_deck_name = newDeckName
            }

            const result = await api.saveImport(payload)
            addToast(`Saved ${result.count} questions!`, 'success')
            setParsed(null)
            setRawInput('')
            setSelectedFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
            setNewDeckName('')
            setNewSubjectName('')
            if (onImportComplete) onImportComplete()
        } catch (err) {
            addToast(err.message, 'error')
        }
        setSaving(false)
    }

    const sampleInput = `1. Which layer of the heart is responsible for contraction?
A) Endocardium
B) Myocardium
C) Epicardium
D) Pericardium
Answer: B
Explanation: The myocardium is the thick muscular layer of the heart responsible for contraction and pumping blood.

2. What is the normal resting heart rate for adults?
A) 40-60 bpm
B) 60-100 bpm
C) 100-120 bpm
D) 120-140 bpm
Answer: B
Explanation: The normal resting heart rate for adults is 60-100 beats per minute.`

    return (
        <div className="import-panel">
            <div className="import-panel-header" onClick={() => setExpanded(!expanded)}>
                <h3>📥 Import Questions {parsed && <span className="pill emerald">{parsed.totalParsed} parsed</span>}</h3>
                <span style={{ color: 'var(--text-muted)', fontSize: '1.2rem', transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'none' }}>▼</span>
            </div>

            {expanded && (
                <div className="import-panel-body">
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', marginTop: '1rem' }}>
                        Import MCQs from any AI output format — HTML quiz apps, React/JSX, Markdown, DOCX, or plain text. Handles 50+ questions per batch.
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                        <button
                            className={`btn btn-sm ${importMode === 'text' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setImportMode('text')}
                        >
                            Paste Text
                        </button>
                        <button
                            className={`btn btn-sm ${importMode === 'file' ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => setImportMode('file')}
                        >
                            Upload File
                        </button>
                    </div>

                    {importMode === 'text' ? (
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="form-label">Raw Text Input</label>
                                <button className="btn btn-ghost btn-sm" onClick={() => setRawInput(sampleInput)}>Load Sample</button>
                            </div>
                            <textarea
                                className="textarea"
                                value={rawInput}
                                onChange={e => setRawInput(e.target.value)}
                                placeholder={`Paste questions here in any format:\n\n1. Question text\nA) Option A\nB) Option B\nC) Option C\nD) Option D\nAnswer: B\nExplanation: ...`}
                                style={{ minHeight: '200px', fontFamily: "'Inter', monospace", fontSize: '0.85rem' }}
                            />
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">Select File (HTML, JSX, Markdown, DOCX, or Text)</label>
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                style={{
                                    border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    padding: '3rem 1rem',
                                    textAlign: 'center',
                                    background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'var(--bg-input)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    minHeight: '200px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                }}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept=".html,.htm,.jsx,.tsx,.js,.md,.txt,.docx"
                                    style={{ display: 'none' }}
                                />
                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📁</div>
                                {selectedFile ? (
                                    <>
                                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{selectedFile.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                            {(selectedFile.size / 1024).toFixed(1)} KB
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontWeight: 600 }}>Drag & Drop any file here</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>.html · .jsx · .md · .docx · .txt — or click to browse</div>
                                    </>
                                )}
                            </div>
                            {selectedFile && (
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                    style={{ marginTop: '0.5rem', color: 'var(--danger)' }}
                                >
                                    Clear File
                                </button>
                            )}
                        </div>
                    )}

                    <button
                        className="btn btn-primary"
                        onClick={handleParse}
                        disabled={parsing || (importMode === 'text' ? !rawInput.trim() : !selectedFile)}
                    >
                        {parsing ? '⏳ Parsing...' : '🔍 Parse Questions'}
                    </button>

                    {/* Parsed Preview */}
                    {parsed && (
                        <div style={{ marginTop: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                ✅ {parsed.totalParsed} Questions Parsed
                            </h4>

                            {parsed.subjectSuggestions?.length > 0 && (
                                <div style={{ marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Suggested subjects: </span>
                                    {parsed.subjectSuggestions.map(s => (
                                        <span key={s.name} className="pill blue" style={{ marginRight: '0.25rem' }}>{s.name}</span>
                                    ))}
                                </div>
                            )}

                            {/* Preview Questions - Scrollable */}
                            <div className="import-preview" style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                                {parsed.questions.map((q, i) => (
                                    <div key={i} className="import-preview-item" style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
                                        <div className="q-text" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Q{i + 1}: {q.question_text}</div>
                                        <div className="q-options" style={{ paddingLeft: '1rem' }}>
                                            {q.options.map((opt, j) => (
                                                <div key={j} className={j === q.correct_index ? 'q-correct' : ''} style={{ color: j === q.correct_index ? 'var(--success)' : 'inherit', fontWeight: j === q.correct_index ? 600 : 400 }}>
                                                    {String.fromCharCode(65 + j)}) {opt} {j === q.correct_index && '✓'}
                                                </div>
                                            ))}
                                        </div>
                                        {q.explanation && (
                                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(56, 189, 248, 0.05)', borderRadius: 'var(--radius-sm)' }}>
                                                <strong>Explanation:</strong> {q.explanation}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Save Destination */}
                            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>Save to...</h4>

                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <button className={`btn btn-sm ${targetMode === 'existing' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTargetMode('existing')}>Existing Deck</button>
                                    <button className={`btn btn-sm ${targetMode === 'new_deck' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTargetMode('new_deck')}>New Deck</button>
                                    <button className={`btn btn-sm ${targetMode === 'new_both' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTargetMode('new_both')}>New Subject + Deck</button>
                                </div>

                                {targetMode === 'existing' && (
                                    <select className="select" value={selectedDeckId} onChange={e => setSelectedDeckId(e.target.value)}>
                                        <option value="">-- Select a deck --</option>
                                        {(parsed.existingDecks || []).map(d => (
                                            <option key={d.id} value={d.id}>{d.subject_name} → {d.name}</option>
                                        ))}
                                    </select>
                                )}

                                {targetMode === 'new_deck' && (
                                    <div>
                                        <div className="form-group">
                                            <label className="form-label">Subject</label>
                                            <select className="select" value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)}>
                                                <option value="">-- Select subject --</option>
                                                {(parsed.existingSubjects || []).map(s => (
                                                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">New Deck Name</label>
                                            <input className="input" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="e.g. Cardiology Block 1" />
                                        </div>
                                    </div>
                                )}

                                {targetMode === 'new_both' && (
                                    <div>
                                        <div className="form-group">
                                            <label className="form-label">New Subject Name</label>
                                            <input className="input" value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} placeholder="e.g. Cardiology" />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">New Deck Name</label>
                                            <input className="input" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} placeholder="e.g. Block 1" />
                                        </div>
                                    </div>
                                )}

                                <button className="btn btn-success" onClick={handleSave} disabled={saving} style={{ marginTop: '0.75rem', width: '100%' }}>
                                    {saving ? '⏳ Saving...' : `💾 Save ${parsed.totalParsed} Questions`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )
            }
        </div >
    )
}
