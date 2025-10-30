let cachedHandler;

export default async function handler(req, res) {
    if (!cachedHandler) {
        const { default: serverless } = await import('serverless-http');
        const { createApp } = require('../backend/src/createApp.js'); // CJS require
        const app = createApp();
        cachedHandler = serverless(app);
    }
    return cachedHandler(req, res);
}