const config = {
    port: process.env.PORT ? Number(process.env.PORT) : 3000,
    openaiKey: process.env.OPENAI_API_KEY || null,
};

module.exports = config;
