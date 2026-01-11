const {createChatCompletion} = require('../../../shared/services/openaiService');
const {getPersona} = require('../models/personaModel');
const memoryModel = require('../models/memoryModel');

async function generateChallenge(domain, personaId = 'zen') {
    const persona = getPersona(personaId);

    const prompt = `
    ${persona.systemPrompt}

    SITUATION:
    The user is trying to open ${domain}, which is currently BLOCKED.
    You are the gatekeeper standing in their way.

    TASK:
    Demand to know the specific reason why they need to enter this site right now.

    CONSTRAINTS:
    1. Do NOT imply they are avoiding the site (they are trying to enter!).
    2. Do NOT say "click", "tap", "link", or "button".
    3. Be suspicious. Assume they are about to procrastinate.
    4. Keep it under 20 words.
    `;

    const completion = await createChatCompletion({
        model: 'gpt-4.1-nano',
        messages: [{role: 'user', content: prompt}],
        max_tokens: 50,
        temperature: 0.7,
    });

    return completion?.choices?.[0]?.message?.content?.trim() || `Why are you here?`;
}

async function evaluateReason(domain, reason, personaId = 'zen') {
    const persona = getPersona(personaId);

    // Get recent excuse history to detect patterns
    const recentExcuses = memoryModel.getRecentExcuses(domain, 24);
    const excuseList = recentExcuses
        .map((e) => `- "${e.excuse}" (${e.approved ? 'APPROVED' : 'DENIED'})`)
        .join('\n');

    const historyContext =
        recentExcuses.length > 0
            ? `\nRECENT EXCUSE HISTORY (last 24h):\n${excuseList}\n\nDetect if the user is trying to CHEAT by reusing similar excuses or abusing the system.`
            : '';

    const systemPrompt = `
    ### SYSTEM INSTRUCTION
    You are a Productivity AI. Perform these jobs in strict order.

    ${historyContext}

    ---

    ### JOB 1: THE SPAM FILTER (Anti-Cheat)
    *Compare current Input vs User History.*
    
    1. **The "Broken Record" Rule:**
       - If the user repeats the **exact same excuse** (or very similar phrasing) that was recently **Approved**, assume they are lying/spamming.
       - **VERDICT: DENY.**
       - *Reasoning:* "You already used this excuse. You should have finished the task."
    
    2. **The "Boy Who Cried Wolf" Rule:**
       - If the user has made 3+ "Emergency" or "Client" requests in the last hour.
       - **VERDICT: DENY.**
       - *Reasoning:* "Too many emergencies today. Suspicious."

    ---

    ### JOB 2: THE REALITY CHECK (Sanity Filter) - CRITICAL
    *Before applying rules, check if the excuse makes sense.*
    
    1. **The "Troll" Rule (Absurdity):**
       - If the user asks for a ridiculous duration for an emergency (e.g., "5 days" for a fire, "10 hours" to call an ambulance).
       - **VERDICT: DENY.**
       - *Reasoning:* Emergencies require immediate action, not 5 days of access.

    2. **The "Solution Mismatch" Rule:**
       - Does the Website actually solve the Problem?
       - Problem: "Fire". Solution: "YouTube Shorts". -> **Mismatch (DENY)**.
       - Problem: "Fire". Solution: "How to use extinguisher video". -> **Match (APPROVE)**.

    ---

    ### JOB 3: THE LOGIC JUDGE (Categorize)
    1. **Emergency/Health:** "Fire", "Hospital", "Dying", "Bleeding", "Pain".
    2. **Work/Edu:** "Client", "Boss", "Homework", "Study", "How to", "Tutorial".
    3. **Brainrot/Leisure:** "Bored", "Shorts", "Reels", "Fun", "Calm down".

    ---

    ### JOB 4: THE "BS DETECTOR" (Logical Consistency Check)
    
    1. **The "Survivalist" Rule (Emergency Instructions):**
       - If user mentions an EMERGENCY ("Fire", "Leak", "Broken") AND wants **INFORMATION** ("How to", "Guide", "Fix"):
       - **VERDICT: APPROVE.**
       - *Reasoning:* Even if dangerous, the user is seeking a solution, not entertainment.
    
    2. **The "Panic" Rule (Emergency Distraction):**
       - If user mentions EMERGENCY but wants **COMFORT/DISTRACTION** ("Calm down", "Distract me", "Music"):
       - **VERDICT: DENY.**
       - *Reasoning:* Distraction during an emergency is unsafe.

    3. **The "Brainrot" Rule:**
       - "Shorts"/"Reels" -> **DENY** (Unless "How to" / "Creating").
    
    4. **The "Work" Rule:**
       - Work/Edu -> **APPROVE** (Unless obviously impossible, e.g. "Excel on Instagram").

    ---

    ### JOB 5: TIME KEEPER (Duration Logic)

    **IF APPROVED (Access Duration):**
    - Extract user request (e.g., "30 sec", "5 min").
    - Default: 300s (Quick), 1800s (Long).
    - Cap: 60 mins.

    **IF DENIED (Saved Time Estimation):**
    - Estimate how much time the user WOULD have wasted.
    - "Shorts/TikTok" = 45 mins.
    - "Movie/Netflix" = 120 mins.
    - "Bored/Checking" = 15 mins.
    - "Just looking" = 5 mins.

    ---

    ### JOB 6: THE CREATIVE WRITER (Persona: ${persona.name})
    - Write a response based on the Verdict.
    - ${persona.systemPrompt}
    - **IF EMERGENCY APPROVED:** "Quickly! Here is the access. Stay safe."
    - **IF DENIED:** Roast them logicallly.

    ---

    ### INPUT
    - Domain: "${domain}"
    - Excuse: "${reason}"

    ### OUTPUT JSON ONLY
    {
      "reasoning": "string",
      "approved": boolean,
      "reply": "string",
      "allowed_duration": number,
      "saved_minutes": number (0 if Approved. Estimated minutes if Denied.)
    }`;

    const completion = await createChatCompletion({
        model: 'gpt-4.1-nano',
        messages: [{role: 'system', content: systemPrompt}],
        max_tokens: 200,
        temperature: 0.5,
    });

    const text = completion?.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const result = JSON.parse(jsonMatch[0]);

            memoryModel.addExcuse(domain, reason, result.approved);
            return result;
        } catch (e) {
            console.error('JSON parse failed:', e);
        }
    }

    const lower = reason.toLowerCase();
    const approved = !(lower.includes('bored') || lower.length < 10);
    memoryModel.addExcuse(domain, reason, approved);
    return {
        approved,
        reply: approved ? 'Fine. Keep it brief.' : 'Nope. Not today.',
        allowed_duration: approved ? 300 : 0,
        saved_minutes: approved ? 0 : 15,
    };
}

module.exports = {generateChallenge, evaluateReason};
