// In-memory database for BlockMate
const memoryDB = {
    accessLog: {}, // { [domain]: timestampMillis }
    stats: {
        attempts: 0,
        savedMinutes: 0,
    },
};

function getLast(domain) {
    return memoryDB.accessLog[domain] || null;
}

function setLast(domain, ts = Date.now()) {
    memoryDB.accessLog[domain] = ts;
}

function minutesSince(ts) {
    if (!ts) return null;
    return Math.floor((Date.now() - ts) / 60000);
}

function getStats() {
    return {...memoryDB.stats};
}

function incrementAttempts() {
    memoryDB.stats.attempts += 1;
}

function incrementSavedMinutes(minutes) {
    memoryDB.stats.savedMinutes += minutes;
}

module.exports = {
    getLast,
    setLast,
    minutesSince,
    getStats,
    incrementAttempts,
    incrementSavedMinutes,
};
