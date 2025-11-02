import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import purchasesRoutes from './routes/purchases.js';
import purchasesListRoutes from './routes/purchases.list.js';
import purchasesSettleRoutes from './routes/purchases.settle.js';
import reportsRoutes from './routes/reports.currentBalance.js';
import categoryTotalsRoutes from './routes/reports.categoryTotals.js';
import trendRoute from './routes/reports.spending-trend.js';
import budgetsRoute from './routes/budgets.js';
import invitesRoute from './routes/invites.js';
import notificationsRoute from './routes/notifications.js';
import incomeTotalsRoutes from './routes/reports.incomeTotals.js';

export function createApp() {
    const app = express();

    app.set('trust proxy', 1);

    const corsOpts = {
        origin: process.env.CORS_ORIGIN || undefined,
        credentials: true,
    };

    app.use(cors(corsOpts));
    app.options('*', cors(corsOpts));

    app.use(express.json());
    app.use(cookieParser());
    // Do NOT serve static files from a serverless function on Vercel
    // app.use(express.static('public'));

    // Health & root
    app.get('/api', (_req, res) => res.json({ ok: true }));
    app.get('/api/health', (_req, res) => {
        res.json({
            ok: true,
            nodeEnv: process.env.NODE_ENV,
            hasDbUrl: !!process.env.DATABASE_URL,
        });
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/purchases', purchasesRoutes);
    app.use('/api/purchases', purchasesListRoutes);
    app.use('/api/purchases', purchasesSettleRoutes);
    app.use('/api/reports', reportsRoutes);
    app.use('/api/reports', categoryTotalsRoutes);
    app.use('/api/reports', incomeTotalsRoutes);
    app.use('/api/budgets', trendRoute);
    app.use('/api/budgets', budgetsRoute);
    app.use('/api/invites', invitesRoute);
    app.use('/api/notifications', notificationsRoute);

    // 404 and error handler
    app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
    // eslint-disable-next-line no-unused-vars
    app.use((err, _req, res, _next) => {
        console.error(err);
        res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
    });

    return app;
}
