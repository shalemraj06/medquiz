import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from '../utils/api'

export default function Sidebar() {
    const location = useLocation()
    const [reviewStats, setReviewStats] = useState({ starred: 0, wrong: 0, reviewDue: 0 })

    useEffect(() => {
        api.getReviewStats().then(setReviewStats).catch(() => { })
    }, [location.pathname])

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">🏥</div>
                <h1>MedQuiz</h1>
            </div>

            <nav className="sidebar-nav">
                <div className="sidebar-section">
                    <div className="sidebar-section-title">Main</div>
                    <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} end>
                        <span className="icon">📊</span> Dashboard
                    </NavLink>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">Review</div>
                    <NavLink to="/review?filter=starred" className={({ isActive }) => `sidebar-link ${location.search.includes('starred') && isActive ? 'active' : ''}`}>
                        <span className="icon">⭐</span> Starred
                        {reviewStats.starred > 0 && <span className="badge">{reviewStats.starred}</span>}
                    </NavLink>
                    <NavLink to="/review?filter=wrong" className={({ isActive }) => `sidebar-link ${location.search.includes('wrong') && isActive ? 'active' : ''}`}>
                        <span className="icon">❌</span> Wrong Answers
                        {reviewStats.wrong > 0 && <span className="badge" style={{ background: '#ef4444' }}>{reviewStats.wrong}</span>}
                    </NavLink>
                    <NavLink to="/review?filter=review" className={({ isActive }) => `sidebar-link ${location.search.includes('review') && location.search.includes('filter=review') ? 'active' : ''}`}>
                        <span className="icon">🔄</span> Spaced Review
                        {reviewStats.reviewDue > 0 && <span className="badge" style={{ background: '#f59e0b' }}>{reviewStats.reviewDue}</span>}
                    </NavLink>
                </div>

                <div className="sidebar-section">
                    <div className="sidebar-section-title">System</div>
                    <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                        <span className="icon">⚙️</span> Settings
                    </NavLink>
                </div>
            </nav>

            <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                <button
                    onClick={() => { localStorage.removeItem('medquiz_token'); window.location.href = '/'; }}
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}
                >
                    <span className="icon">🚪</span> Logout
                </button>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem' }}>
                    MedQuiz v1.0 • Built for Excellence
                </div>
            </div>
        </aside>
    )
}
