function qs(name) {
    const params = new URLSearchParams(location.search);
    return params.get(name);
}

const original = qs('url') || '';
let domain = '';
let currentPersona = 'zen';
try {
    domain = new URL(original).hostname;
} catch (e) {
    domain = original;
}

const aiMessage = document.getElementById('aiMessage');
const responseEl = document.getElementById('response');

function loadPersona() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['blockmate_persona'], (obj) => {
            currentPersona = obj.blockmate_persona || 'zen';
            resolve(currentPersona);
        });
    });
}

async function loadChallenge() {
    if (!domain) {
        aiMessage.textContent = 'Blocked — cannot determine site.';
        return;
    }

    aiMessage.textContent = 'Thinking...';

    try {
        const url =
            'http://localhost:3000/api/challenge?app=' +
            encodeURIComponent(domain) +
            '&persona=' +
            currentPersona;
        const res = await fetch(url);
        const data = await res.json();
        aiMessage.textContent = data.message || 'Why are you here?';
    } catch (e) {
        aiMessage.textContent = 'Could not reach brain (backend).';
    }
}

document.getElementById('negotiate').addEventListener('click', async () => {
    const reason = document.getElementById('reason').value.trim();
    if (!reason) return (responseEl.textContent = 'Type an excuse.');
    responseEl.textContent = 'Negotiating...';
    responseEl.style.color = '#fff';

    try {
        console.log('[BLOCKED] Sending evaluate request to backend...');
        const res = await fetch('http://localhost:3000/api/evaluate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({app: domain, reason, persona: currentPersona}),
        });
        const data = await res.json();
        console.log('[BLOCKED] Backend response:', data);
        if (data.approved) {
            const duration = data.allowed_duration || 1800;
            const minutes = Math.round(duration / 60);

            responseEl.style.color = '#0f0';
            responseEl.textContent = data.reply + ` ✅ Access for ${minutes} minutes!`;
            document.querySelector('h1').textContent = '✅ Access Granted';
            document.querySelector('h1').style.color = '#0f0';
            document.querySelector('p').textContent = `Loading website in 5 seconds...`;

            chrome.runtime.sendMessage(
                {type: 'TEMPORARY_UNLOCK', url: original, duration: duration},
                (r) => {
                    console.log('[BLOCKED] TEMPORARY_UNLOCK response:', r);
                    if (r && r.ok) {
                        console.log(
                            '[BLOCKED] Rule removed, waiting 5 seconds before direct navigation...',
                        );

                        setTimeout(() => {
                            console.log(
                                '[BLOCKED] Navigating directly using window.location.href to:',
                                original,
                            );
                            window.location.href = original;
                        }, 5000);
                    } else {
                        console.log('[BLOCKED] Unlock failed:', r);
                        responseEl.style.color = '#f55';
                        responseEl.textContent = 'Failed to unlock. Try again.';
                        document.querySelector('h1').textContent = '🚫 Access Blocked';
                        document.querySelector('h1').style.color = '#ff6b6b';
                        document.querySelector('p').textContent = 'Error unlocking access';
                    }
                },
            );
        } else {
            console.log('[BLOCKED] Approval denied:', data.reply);
            responseEl.style.color = '#f55';
            responseEl.textContent = data.reply;
        }
    } catch (e) {
        console.error('[BLOCKED] Error during negotiation:', e);
        responseEl.style.color = '#f55';
        responseEl.textContent = 'Error contacting brain.';
    }
});

// Load persona first, then challenge
(async () => {
    await loadPersona();
    loadChallenge();
})();
