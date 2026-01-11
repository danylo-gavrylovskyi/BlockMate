const STORAGE_KEY = 'blockmate_rules';

async function getBlocked() {
    return new Promise((res) =>
        chrome.storage.local.get([STORAGE_KEY], (obj) => res(obj[STORAGE_KEY] || {})),
    );
}

async function setBlocked(val) {
    return new Promise((res) => chrome.storage.local.set({[STORAGE_KEY]: val}, res));
}
