const {OpenAI} = require('openai');
const config = require('../../config');

const client = new OpenAI({apiKey: config.openaiKey});

async function createChatCompletion(opts = {}) {
    const {model = 'gpt-4.1-nano', messages = [], max_tokens = 150, temperature = 0.7} = opts;
    return client.chat.completions.create({model, messages, max_tokens, temperature});
}

module.exports = {createChatCompletion};
