const aiChatService = require('../services/aiChatService');
const memoryModel = require('../models/memoryModel');

async function challenge(req, res) {
    try {
        const domain = req.query.app;
        const persona = req.query.persona || 'zen';
        if (!domain) return res.status(400).json({error: 'app query required'});

        const last = memoryModel.getLast(domain);
        const mins = memoryModel.minutesSince(last);
        const message = await aiChatService.generateChallenge(domain, persona);

        res.json({message});
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'internal'});
    }
}

async function evaluate(req, res) {
    try {
        const {app: domain, reason, persona = 'zen'} = req.body || {};
        if (!domain || !reason) return res.status(400).json({error: 'app and reason required'});

        const result = await aiChatService.evaluateReason(domain, reason, persona);

        // Track attempt
        memoryModel.incrementAttempts();

        if (result.approved) {
            memoryModel.setLast(domain);
        } else {
            // Track saved time
            memoryModel.incrementSavedMinutes(result.saved_minutes || 15);
        }

        // Return to extension (use allowed_duration as duration key)
        res.json({
            approved: result.approved,
            reply: result.reply,
            duration: result.allowed_duration || 0,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'internal'});
    }
}

async function stats(req, res) {
    try {
        const statsData = memoryModel.getStats();
        res.json(statsData);
    } catch (err) {
        console.error(err);
        res.status(500).json({error: 'internal'});
    }
}

module.exports = {challenge, evaluate, stats};
