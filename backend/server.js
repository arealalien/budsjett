import express from 'express';
import cors from "cors";
import cookieParser from 'cookie-parser';

import authRoutes from './src/routes/auth.js';
import purchasesRoutes from './src/routes/purchases.js';
import purchasesListRoutes from './src/routes/purchases.list.js';
import purchasesSettleRoutes from './src/routes/purchases.settle.js';
import reportsRoutes from './src/routes/reports.currentBalance.js';
import categoryTotalsRoutes from './src/routes/reports.categoryTotals.js';
import trendRoute from './src/routes/reports.spending-trend.js';
import budgetsRoute from './src/routes/budgets.js';
import invitesRoute from './src/routes/invites.js';
import notificationsRoute from './src/routes/notifications.js';
import incomeTotalsRoutes from './src/routes/reports.incomeTotals.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.use(express.static("public"));

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

app.listen(4000, () => console.log("Server running on port 4000"));