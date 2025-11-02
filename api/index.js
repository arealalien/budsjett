let appPromise;

export default async function handler(req, res) {
    try {
        if (!appPromise) {
            appPromise = (async () => {
                const { createApp } = await import('../backend/src/createApp.js');
                return createApp();
            })();
        }
        const app = await appPromise;
        return app(req, res);
    } catch (err) {
        console.error('API init error:', err);
        res
            .status(500)
            .setHeader('content-type', 'text/plain')
            .end('Init error:\n' + (err?.stack || String(err)));
    }
}