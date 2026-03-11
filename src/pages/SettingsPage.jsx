import { useState, useEffect } from 'react'
import { api } from '../utils/api'

export default function SettingsPage({ addToast }) {
    const [settings, setSettings] = useState({})
    const [claudeKey, setClaudeKey] = useState('')
    const [geminiKey, setGeminiKey] = useState('')
    const [preferredAi, setPreferredAi] = useState('local')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.getSettings().then(data => {
            setSettings(data)
            setPreferredAi(data.preferred_ai || 'local')
        }).catch(() => { })
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const updates = { preferred_ai: preferredAi }
            if (claudeKey && !claudeKey.startsWith('••••')) updates.claude_api_key = claudeKey
            if (geminiKey && !geminiKey.startsWith('••••')) updates.gemini_api_key = geminiKey
            await api.updateSettings(updates)
            setClaudeKey('')
            setGeminiKey('')
            addToast('Settings saved!', 'success')
            // Refresh
            const data = await api.getSettings()
            setSettings(data)
        } catch (err) { addToast(err.message, 'error') }
        setSaving(false)
    }

    const handleClearKey = async (type) => {
        try {
            await api.updateSettings({ [`${type}_api_key`]: '' })
            addToast(`${type === 'claude' ? 'Claude' : 'Gemini'} API key removed`, 'success')
            const data = await api.getSettings()
            setSettings(data)
        } catch (err) { addToast(err.message, 'error') }
    }

    return (
        <div style={{ maxWidth: 700 }}>
            <div className="page-header">
                <h2>⚙️ Settings</h2>
                <p>Configure AI API keys and application preferences.</p>
            </div>

            {/* AI API Keys */}
            <div className="settings-card">
                <h3>🤖 AI Integration</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Add your API keys to unlock smarter question parsing, auto-generated explanations, and intelligent subject classification.
                    Without keys, the built-in local parser handles everything offline.
                </p>

                <div className="form-group">
                    <label className="form-label">Preferred AI Provider</label>
                    <select className="select" value={preferredAi} onChange={e => setPreferredAi(e.target.value)}>
                        <option value="local">Local Parser (No API)</option>
                        <option value="claude">Claude (Anthropic)</option>
                        <option value="gemini">Gemini (Google)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">
                        Claude API Key
                        {settings.claude_api_key_set && <span className="pill emerald" style={{ marginLeft: '0.5rem' }}>✓ Set</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            className="input"
                            type="password"
                            value={claudeKey}
                            onChange={e => setClaudeKey(e.target.value)}
                            placeholder={settings.claude_api_key_set ? settings.claude_api_key : 'sk-ant-...'}
                        />
                        {settings.claude_api_key_set && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleClearKey('claude')} title="Remove key">🗑️</button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Get your key from <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>console.anthropic.com</a>
                    </span>
                </div>

                <div className="form-group">
                    <label className="form-label">
                        Gemini API Key
                        {settings.gemini_api_key_set && <span className="pill emerald" style={{ marginLeft: '0.5rem' }}>✓ Set</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            className="input"
                            type="password"
                            value={geminiKey}
                            onChange={e => setGeminiKey(e.target.value)}
                            placeholder={settings.gemini_api_key_set ? settings.gemini_api_key : 'AIza...'}
                        />
                        {settings.gemini_api_key_set && (
                            <button className="btn btn-ghost btn-sm" onClick={() => handleClearKey('gemini')} title="Remove key">🗑️</button>
                        )}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)' }}>aistudio.google.com</a>
                    </span>
                </div>

                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? '⏳ Saving...' : '💾 Save Settings'}
                </button>
            </div>

            {/* AI Features Info */}
            <div className="settings-card">
                <h3>✨ AI Features</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <p style={{ marginBottom: '0.5rem' }}>When an API key is configured, you unlock:</p>
                    <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
                        <li><strong style={{ color: 'var(--text-primary)' }}>Smart Parsing</strong> — AI extracts MCQs from messy, ambiguous, or complex input formats</li>
                        <li><strong style={{ color: 'var(--text-primary)' }}>Auto Explanations</strong> — Generates detailed medical explanations for questions that don't have one</li>
                        <li><strong style={{ color: 'var(--text-primary)' }}>Subject Classification</strong> — Intelligently categorizes questions into the right subjects and decks</li>
                        <li><strong style={{ color: 'var(--text-primary)' }}>"AI Explain" Button</strong> — During test review, click to get an AI-generated explanation for any question</li>
                    </ul>
                </div>
            </div>

            {/* Data Info */}
            <div className="settings-card">
                <h3>💾 Data</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                    All your data is stored locally in an SQLite database on your machine. Nothing is sent to external servers unless you use AI features with API keys.
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Database location: <code style={{ background: 'var(--bg-input)', padding: '0.15rem 0.35rem', borderRadius: 4, fontSize: '0.75rem' }}>server/medquiz.db</code>
                </p>
            </div>
        </div>
    )
}
