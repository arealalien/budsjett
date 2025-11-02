let cachedHandler;

export default async function handler(req, res) {
    try {
        if (!cachedHandler) {
            const { default: serverless } = await import('serverless-http');
            const { createApp } = await import('../backend/src/createApp.js');
            const app = createApp();
            cachedHandler = serverless(app);
        }
        return cachedHandler(req, res);
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .setHeader('content-type', 'text/plain')
            .end('Init error:\n' + (err?.stack || String(err)));
    }
}