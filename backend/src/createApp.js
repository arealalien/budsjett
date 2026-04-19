import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth.js';
import purchasesRoutes from './routes/purchases.js';
import purchasesListRoutes from './routes/purchases.list.js';
import purchasesSettleRoutes from './routes/purchases.settle.js';
import purchaseDetailRoute from './routes/purchases.detail.js';
import reportsRoutes from './routes/reports.currentBalance.js';
import categoryTotalsRoutes from './routes/reports.categoryTotals.js';
import trendRoute from './routes/reports.spending-trend.js';
import categoryTrendRoute from './routes/reports.category-trend.js';
import budgetsRoute from './routes/budgets.js';
import invitesRoute from './routes/invites.js';
import notificationsRoute from './routes/notifications.js';
import incomeTotalsRoutes from './routes/reports.incomeTotals.js';
import userSettingsRoute from './routes/users.settings.js';
import userAvatarRoute from './routes/users.avatar.js';

export function createApp() {
    const app = express();

    app.set('trust proxy', 1);

    app.use(cors({
        origin: process.env.CORS_ORIGIN || undefined,
        credentials: true,
    }));

    app.use(cookieParser());
    app.use(express.json());
    app.use(express.static('public'));

    app.use('/api/auth', authRoutes);
    app.use('/api/purchases', purchasesRoutes);
    app.use('/api/purchases', purchasesListRoutes);
    app.use('/api/purchases', purchasesSettleRoutes);
    app.use('/api/purchases', purchaseDetailRoute);
    app.use('/api/reports', reportsRoutes);
    app.use('/api/reports', categoryTotalsRoutes);
    app.use('/api/reports', incomeTotalsRoutes);
    app.use('/api/budgets', trendRoute);
    app.use('/api/budgets', categoryTrendRoute);
    app.use('/api/budgets', budgetsRoute);
    app.use('/api/invites', invitesRoute);
    app.use('/api/notifications', notificationsRoute);
    app.use('/api/users', userSettingsRoute);
    app.use('/api/users', userAvatarRoute);

    app.get('/api', (_req, res) => {
        res.json({ ok: true });
    });

    app.get('/api/health', (_req, res) => {
        res.json({
            ok: true,
            nodeEnv: process.env.NODE_ENV,
            hasDbUrl: !!process.env.DATABASE_URL,
        });
    });

    app.use((err, req, res, next) => {
        console.error(err);

        if (res.headersSent) {
            return next(err);
        }

        res.status(err.status || 500).json({
            error: err.message || 'Internal server error',
        });
    });

    return app;
}