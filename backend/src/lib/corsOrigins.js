const LOCAL_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    'http://127.0.0.1:3003',
    'http://127.0.0.1:3004',
];

const LIVE_ORIGINS = [
    'https://astrae.no',
    'https://www.astrae.no',
];

function splitOrigins(value) {
    return String(value || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}

export function getClientOrigins() {
    const configured = [
        ...splitOrigins(process.env.CORS_ORIGINS),
        ...splitOrigins(process.env.CORS_ORIGIN),
    ];

    return [...new Set([...configured, ...LIVE_ORIGINS, ...LOCAL_ORIGINS])];
}

export function isAllowedOrigin(origin) {
    if (!origin) return true;
    return getClientOrigins().includes(origin);
}

export function getCorsOptions() {
    return {
        origin(origin, callback) {
            callback(null, isAllowedOrigin(origin));
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'If-None-Match'],
        exposedHeaders: ['ETag'],
    };
}

export function getPublicAssetOrigin() {
    return process.env.PUBLIC_ASSET_ORIGIN || '*';
}
