async function loadStats() {
    try {
        const res = await fetch('http://localhost:3000/api/stats');
        const data = await res.json();
        document.getElementById('attempts').textContent = data.attempts || 0;
        document.getElementById('savedMins').textContent = (data.savedMinutes || 0) + ' mins';
    } catch (e) {
        console.error('Failed to load stats:', e);
    }
}

async function loadPersona() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['blockmate_persona'], (obj) => {
            const persona = obj.blockmate_persona || 'zen';
            document.querySelector(`input[name="persona"][value="${persona}"]`).checked = true;
            resolve(persona);
        });
    });
}

function savePersona(persona) {
    chrome.storage.local.set({blockmate_persona: persona});
}

document.querySelectorAll('input[name="persona"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
        savePersona(e.target.value);
    });
});

document.getElementById('lock').addEventListener('click', async () => {
    const url = document.getElementById('url').value.trim();
    const status = document.getElementById('status');
    if (!url) return (status.textContent = 'Enter a URL');
    try {
        const res = await chrome.runtime.sendMessage({type: 'BLOCK_SITE', url});
        if (res && res.ok) {
            status.textContent = 'Blocked!';
            document.getElementById('url').value = '';
        } else {
            status.textContent = 'Failed: ' + (res.error || 'unknown');
        }
    } catch (e) {
        status.textContent = 'Error: ' + e.message;
    }
});

// Pre-fill with current tab URL
chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
        document.getElementById('url').value = tabs[0].url;
    }
});

loadStats();
loadPersona();

// Refresh stats every 2 seconds
setInterval(loadStats, 2000);
