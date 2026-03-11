const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'medquiz_local_secret_key_12345';

module.exports = function (req, res, next) {
    // Get token from header
    const authHeader = req.header('Authorization');

    // Check if no header or invalid format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token, authorization denied' });
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Add user payload to request
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};
