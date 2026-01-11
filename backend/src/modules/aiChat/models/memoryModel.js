// In-memory database for BlockMate
const memoryDB = {
    accessLog: {}, // { [domain]: timestampMillis }
    excuseHistory: {}, // { [domain]: [{excuse: string, timestamp: ms, approved: bool}, ...] }
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

function addExcuse(domain, excuse, approved) {
    if (!memoryDB.excuseHistory[domain]) {
        memoryDB.excuseHistory[domain] = [];
    }
    memoryDB.excuseHistory[domain].push({
        excuse: excuse.trim(),
        timestamp: Date.now(),
        approved,
    });
    // Keep only last 20 excuses per domain to avoid memory bloat
    if (memoryDB.excuseHistory[domain].length > 20) {
        memoryDB.excuseHistory[domain].shift();
    }
}

function getRecentExcuses(domain, hoursBack = 24) {
    if (!memoryDB.excuseHistory[domain]) return [];
    const cutoffTime = Date.now() - hoursBack * 3600000;
    return memoryDB.excuseHistory[domain].filter((e) => e.timestamp > cutoffTime);
}

module.exports = {
    getLast,
    setLast,
    minutesSince,
    getStats,
    incrementAttempts,
    incrementSavedMinutes,
    addExcuse,
    getRecentExcuses,
};
