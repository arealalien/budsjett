let cachedHandler;

module.exports = async (req, res) => {
    if (!cachedHandler) {
        const { default: serverless } = await import('serverless-http');
        const { createApp } = await import('../backend/src/createApp.js');
        const app = createApp();
        cachedHandler = serverless(app);
    }
    return cachedHandler(req, res);
};