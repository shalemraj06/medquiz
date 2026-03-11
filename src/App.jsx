import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useCallback, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import SubjectView from './pages/SubjectView'
import TestSession from './pages/TestSession'
import TestSummary from './pages/TestSummary'
import ReviewPage from './pages/ReviewPage'
import SettingsPage from './pages/SettingsPage'
import AuthPage from './pages/AuthPage'
import { api } from './utils/api'

function ToastContainer({ toasts, removeToast }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast ${t.type}`} onClick={() => removeToast(t.id)}>
                    <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    )
}

export default function App() {
    const [toasts, setToasts] = useState([])
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('medquiz_token');
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                await api.getMe();
                setIsAuthenticated(true);
            } catch (err) {
                localStorage.removeItem('medquiz_token');
            }
            setIsLoading(false);
        };
        checkAuth();
    }, []);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now()
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    if (isLoading) {
        return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-body)' }}>Loading...</div>;
    }

    if (!isAuthenticated) {
        return (
            <>
                <AuthPage onLogin={() => setIsAuthenticated(true)} addToast={addToast} />
                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </>
        )
    }

    return (
        <BrowserRouter>
            <div className="app-layout">
                <Sidebar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Dashboard addToast={addToast} />} />
                        <Route path="/subject/:id" element={<SubjectView addToast={addToast} />} />
                        <Route path="/test/:sessionId" element={<TestSession addToast={addToast} />} />
                        <Route path="/summary/:sessionId" element={<TestSummary addToast={addToast} />} />
                        <Route path="/review" element={<ReviewPage addToast={addToast} />} />
                        <Route path="/settings" element={<SettingsPage addToast={addToast} />} />
                    </Routes>
                </main>
                <ToastContainer toasts={toasts} removeToast={removeToast} />
            </div>
        </BrowserRouter>
    )
}
