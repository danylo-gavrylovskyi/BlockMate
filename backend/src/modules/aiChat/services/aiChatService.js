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
    You are a Productivity AI. You have two distinct jobs that you must perform in order:
    
    JOB 1: THE LOGIC JUDGE (Strict, No Opinions)
    - Analyze the intent. 
    - **Valid Work:** Homework, Studying, Clients, Emails, Research, Tutorials, Coding.
    - **Invalid Distraction:** Boredom, Scrolling, Fun, "Just looking".
    - **CRITICAL RULE:** If the intent is Valid Work, the Domain (YouTube/Insta) DOES NOT MATTER. You MUST Approve.
      - Example: "YouTube for Homework" -> APPROVED.
      - Example: "Instagram for Client" -> APPROVED.
    - **CHEAT DETECTION:** If the user has used the same or very similar excuses multiple times (especially with approvals), DENY this time or reduce duration significantly.

    JOB 2: THE CREATIVE WRITER (The Persona)
    - Once the Verdict (Job 1) is decided, write a response acting as: **${persona.name}**.
    - ${persona.systemPrompt}
    - **CREATIVITY RULE:** Do not be boring. React specifically to the user's input.
    - **RESTRICTION:** If you Approved a valid work task, DO NOT lecture the user. Just confirm it.
    - **CALL OUT CHEATING:** If you detect abuse, make it funny but firm.${historyContext}

    ### INPUT
    - Domain: "${domain}"
    - Current Excuse: "${reason}"

    ### OUTPUT JSON ONLY
    {
      "reasoning": "string (Explain WHY you approved/denied, note if cheat detected)",
      "approved": boolean,
      "reply": "string (The creative persona response)",
      "allowed_duration": number
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
