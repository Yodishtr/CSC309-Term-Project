'use strict'

const WINDOW_MS = 60_000; // 60 seconds
const lastByKey = new Map();

function rateLimit(ip) {
    return (req, res, next) => {
        const key = getKey(req)
        const now = Date.now();
        const last = lastByKey.get(key) || 0;   // if the IP hasnt tried yet, use 0

        if (now - last < WINDOW_MS) {
            return res.status(429).json({'error': 'Too Many Requests'})
        }
        next()
    }
}

module.exports = { rateLimit };
