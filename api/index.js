let cachedHandler;

export default async function handler(req, res) {
    if (!cachedHandler) {
        const { default: serverless } = await import('serverless-http');
        const { createApp } = await import('../backend/src/createApp.js');
        const app = createApp();
        cachedHandler = serverless(app);
    }
    return cachedHandler(req, res);
}