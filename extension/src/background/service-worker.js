const STORAGE_KEY = 'blockmate_rules';
const BYPASS_KEY = 'blockmate_bypass';

async function getBlocked() {
    return new Promise((res) =>
        chrome.storage.local.get([STORAGE_KEY], (obj) => res(obj[STORAGE_KEY] || {})),
    );
}

async function setBlocked(val) {
    return new Promise((res) => chrome.storage.local.set({[STORAGE_KEY]: val}, res));
}

async function getBypass() {
    return new Promise((res) =>
        chrome.storage.local.get([BYPASS_KEY], (obj) => res(obj[BYPASS_KEY] || {})),
    );
}

async function setBypass(val) {
    return new Promise((res) => chrome.storage.local.set({[BYPASS_KEY]: val}, res));
}

function makeRule(domain, redirectUrl, id) {
    // Create rule with a condition that will check for bypass token
    return {
        id,
        priority: 1,
        action: {type: 'redirect', redirect: {url: redirectUrl}},
        condition: {urlFilter: '||' + domain + '^', resourceTypes: ['main_frame']},
    };
}

// Check if domain is currently bypassed
async function isBypassed(domain) {
    const bypass = await getBypass();
    const expiresAt = bypass[domain];
    if (!expiresAt) return false;
    if (Date.now() > expiresAt) {
        delete bypass[domain];
        await setBypass(bypass);
        return false;
    }
    return true;
}

async function addBlock(domain, originalUrl) {
    const redirectUrl = chrome.runtime.getURL(
        'src/blocked/blocked.html?url=' + encodeURIComponent(originalUrl),
    );
    const store = await getBlocked();
    const id = Math.floor(Date.now() % 1000000000);
    const rule = makeRule(domain, redirectUrl, id);

    console.log(
        '[BLOCK] Adding block for domain:',
        domain,
        'with rule ID:',
        id,
        'redirect to:',
        redirectUrl,
    );

    await chrome.declarativeNetRequest.updateDynamicRules({addRules: [rule], removeRuleIds: []});
    store[domain] = {id, redirectUrl};
    await setBlocked(store);

    console.log('[BLOCK] Block added successfully');
    return {domain, id};
}

async function removeBlock(domain) {
    const store = await getBlocked();

    const entry = store[domain];
    if (!entry) {
        console.warn('[REMOVE] No entry found for domain:', domain);
        console.log('[REMOVE] Current store:', store);
        return false;
    }

    try {
        console.log('[REMOVE] Removing rule for domain:', domain, 'rule ID:', entry.id);

        // Get ALL existing rules and remove ALL rules for this domain
        const rules = await chrome.declarativeNetRequest.getDynamicRules();
        const rulesToRemove = rules
            .filter((r) => r.condition?.urlFilter === '||' + domain + '^')
            .map((r) => r.id);

        console.log('[REMOVE] Found', rulesToRemove.length, 'rules to remove for domain:', domain);
        console.log('[REMOVE] Rule IDs to remove:', rulesToRemove);

        if (rulesToRemove.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: [],
                removeRuleIds: rulesToRemove,
            });
            console.log('[REMOVE] All rules removed successfully');
        }
    } catch (e) {
        console.error('[REMOVE] Failed to remove rules:', e);
        return false;
    }
    delete store[domain];
    await setBlocked(store);
    return true;
}

async function reAddBlockAfter(domain, originalUrl, seconds) {
    console.log('[READD] Scheduling re-add of block for', domain, 'after', seconds, 'seconds');

    // Store the pending re-add in storage so it persists if service worker dies
    const pending = await new Promise((res) =>
        chrome.storage.local.get(['blockmate_pending_readd'], (obj) =>
            res(obj.blockmate_pending_readd || {}),
        ),
    );
    pending[domain] = {originalUrl, scheduledAt: Date.now(), durationSeconds: seconds};
    await new Promise((res) => chrome.storage.local.set({blockmate_pending_readd: pending}, res));

    // Use chrome.alarms for persistent timing
    const alarmName = 'readd_' + domain;
    chrome.alarms.create(alarmName, {delayInMinutes: seconds / 60});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        if (msg.type === 'BLOCK_SITE') {
            const {url} = msg;
            try {
                const domain = new URL(url).hostname;
                console.log('[BLOCK_SITE] Received request to block:', url, 'domain:', domain);
                await addBlock(domain, url);
                console.log('[BLOCK_SITE] Successfully blocked');
                sendResponse({ok: true});
            } catch (e) {
                console.error('[BLOCK_SITE] Error:', e);
                sendResponse({ok: false, error: e.message});
            }
        }

        if (msg.type === 'TEMPORARY_UNLOCK') {
            const {url, duration} = msg;
            try {
                const domain = new URL(url).hostname;
                console.log('[UNLOCK] Starting unlock for domain:', domain);

                // First, remove the blocking rule
                const removeSuccess = await removeBlock(domain);
                console.log('[UNLOCK] Rule removed:', removeSuccess);

                // Store bypass timestamp for safety (though rule is removed)
                const bypass = await getBypass();
                const expiresAt = Date.now() + (duration || 1800) * 1000;
                bypass[domain] = expiresAt;
                await setBypass(bypass);
                console.log('[UNLOCK] Bypass token set, expires at:', new Date(expiresAt));

                // Re-add the block after the unlock duration expires
                const unlockDuration = duration || 1800;
                console.log('[UNLOCK] Scheduling re-add after', unlockDuration, 'seconds');
                await reAddBlockAfter(domain, url, unlockDuration);

                sendResponse({ok: true});
            } catch (e) {
                console.error('[UNLOCK] Error:', e);
                sendResponse({ok: false, error: e.message});
            }
        }

        if (msg.type === 'NAVIGATE_TAB') {
            const {url} = msg;
            try {
                console.log('[NAV] NAVIGATE_TAB received for URL:', url);

                const tabId = sender.tab.id;
                console.log('[NAV] Updating tab', tabId, 'to navigate to:', url);

                // Give a small delay to ensure the rule removal has propagated
                setTimeout(() => {
                    console.log('[NAV] Executing chrome.tabs.update');
                    chrome.tabs.update(tabId, {url: url});
                }, 100);

                sendResponse({ok: true});
            } catch (e) {
                console.error('[NAV] NAVIGATE_TAB error:', e);
                sendResponse({ok: false, error: e.message});
            }
        }
    })();
    return true;
});

// Listen for alarms to re-add blocks after unlock duration expires
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('readd_')) {
        const domain = alarm.name.replace('readd_', '');
        console.log('[ALARM] Re-add alarm fired for domain:', domain);

        // Get pending re-add info
        const pending = await new Promise((res) =>
            chrome.storage.local.get(['blockmate_pending_readd'], (obj) =>
                res(obj.blockmate_pending_readd || {}),
            ),
        );

        const info = pending[domain];
        if (info) {
            try {
                console.log('[ALARM] Re-adding block for', domain);
                await addBlock(domain, info.originalUrl);
                delete pending[domain];
                await new Promise((res) =>
                    chrome.storage.local.set({blockmate_pending_readd: pending}, res),
                );
                console.log('[ALARM] Block re-added successfully');
            } catch (e) {
                console.error('[ALARM] Failed to re-add block:', e);
            }
        }
    }
});
