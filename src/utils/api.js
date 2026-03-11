const API_BASE = '/api';

async function request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const token = localStorage.getItem('medquiz_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
    };
    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }
    const res = await fetch(url, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

export const api = {
    // Auth
    login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
    register: (credentials) => request('/auth/register', { method: 'POST', body: credentials }),
    getMe: () => request('/auth/me'),

    // Subjects
    getSubjects: () => request('/subjects'),
    getSubject: (id) => request(`/subjects/${id}`),
    createSubject: (data) => request('/subjects', { method: 'POST', body: data }),
    updateSubject: (id, data) => request(`/subjects/${id}`, { method: 'PUT', body: data }),
    deleteSubject: (id) => request(`/subjects/${id}`, { method: 'DELETE' }),

    // Decks
    getDecks: (subjectId) => request(`/decks${subjectId ? `?subjectId=${subjectId}` : ''}`),
    getDeck: (id) => request(`/decks/${id}`),
    createDeck: (data) => request('/decks', { method: 'POST', body: data }),
    updateDeck: (id, data) => request(`/decks/${id}`, { method: 'PUT', body: data }),
    deleteDeck: (id) => request(`/decks/${id}`, { method: 'DELETE' }),
    resetDeck: (id) => request(`/decks/${id}/reset`, { method: 'POST' }),

    // Questions
    getQuestions: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/questions${qs ? `?${qs}` : ''}`);
    },
    getQuestion: (id) => request(`/questions/${id}`),
    updateQuestion: (id, data) => request(`/questions/${id}`, { method: 'PUT', body: data }),
    moveQuestion: (id, deckId) => request(`/questions/${id}/move`, { method: 'POST', body: { deck_id: deckId } }),
    deleteQuestion: (id) => request(`/questions/${id}`, { method: 'DELETE' }),
    getNote: (id) => request(`/questions/${id}/note`),
    saveNote: (id, text) => request(`/questions/${id}/note`, { method: 'POST', body: { note_text: text } }),

    // Tests
    startTest: (config) => request('/tests/start', { method: 'POST', body: config }),
    submitAnswer: (sessionId, data) => request(`/tests/${sessionId}/answer`, { method: 'POST', body: data }),
    completeTest: (sessionId) => request(`/tests/${sessionId}/complete`, { method: 'POST' }),
    getTestSummary: (sessionId) => request(`/tests/${sessionId}/summary`),
    getTests: () => request('/tests'),

    // Stats
    getDashboardStats: () => request('/stats/dashboard'),
    getReviewStats: () => request('/stats/review'),

    // Import
    parseImport: (rawInput) => request('/import/parse', { method: 'POST', body: { rawInput } }),
    parseImportFile: async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        const token = localStorage.getItem('medquiz_token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE}/import/parse-file`, {
            method: 'POST',
            headers,
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'File parse failed');
        return data;
    },
    saveImport: (data) => request('/import/save', { method: 'POST', body: data }),

    // Settings
    getSettings: () => request('/settings'),
    updateSettings: (data) => request('/settings', { method: 'PUT', body: data }),
    explainAnswer: (questionId) => request('/settings/explain', { method: 'POST', body: { question_id: questionId } }),
};
