import { useState } from 'react';
import { api } from '../utils/api';

export default function AuthPage({ onLogin, addToast }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            addToast('Please enter username and password', 'error');
            return;
        }

        setLoading(true);
        try {
            let res;
            if (isLogin) {
                res = await api.login({ username, password });
                addToast('Logged in successfully', 'success');
            } else {
                res = await api.register({ username, password });
                addToast('Account created successfully', 'success');
            }

            localStorage.setItem('medquiz_token', res.token);
            onLogin();
        } catch (err) {
            addToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: 'var(--bg-body)',
            padding: '1rem',
        }}>
            <div style={{
                background: 'var(--bg-panel)',
                padding: '2rem',
                borderRadius: 'var(--radius-lg)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                width: '100%',
                maxWidth: '400px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏥</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>MedQuiz SaaS</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Welcome back! Please enter your details.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            className="input"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your username"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            className="input"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                    </span>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setIsLogin(!isLogin)}
                        disabled={loading}
                    >
                        {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                </div>
            </div>
        </div>
    );
}
