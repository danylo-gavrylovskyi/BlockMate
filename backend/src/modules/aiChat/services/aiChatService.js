const {createChatCompletion} = require('../../../shared/services/openaiService');
const {getPersona} = require('../models/personaModel');

async function generateChallenge(domain, minutesSince, personaId = 'zen') {
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

    JOB 2: THE CREATIVE WRITER (The Persona)
    - Once the Verdict (Job 1) is decided, write a response acting as: **${persona.name}**.
    - ${persona.systemPrompt}
    - **CREATIVITY RULE:** Do not be boring. React specifically to the user's input.
    - **RESTRICTION:** If you Approved a valid work task, DO NOT lecture the user. Just confirm it.

    ### INPUT
    - Domain: "${domain}"
    - Excuse: "${reason}"

    ### OUTPUT JSON ONLY
    {
      "reasoning": "string (Explain WHY you approved/denied briefly)",
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
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('JSON parse failed:', e);
        }
    }

    const lower = reason.toLowerCase();
    const approved = !(lower.includes('bored') || lower.length < 10);
    return {
        approved,
        reply: approved ? 'Fine. Keep it brief.' : 'Nope. Not today.',
        allowed_duration: approved ? 300 : 0,
        saved_minutes: approved ? 0 : 15,
    };
}

module.exports = {generateChallenge, evaluateReason};
