// src/createApp.js
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

    const corsOrigin = process.env.CORS_ORIGIN || undefined;
    app.use(cors({ origin: corsOrigin, credentials: true }));

    app.use(express.json());
    app.use(cookieParser());

    app.use(express.static('public'));

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

    // quick health probes
    app.get('/api/health', (_req, res) => {
        res.json({ ok: true, nodeEnv: process.env.NODE_ENV, hasDbUrl: !!process.env.DATABASE_URL });
    });

    return app;
}
