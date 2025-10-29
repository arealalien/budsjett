import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/db', async (_req, res) => {
    try {
        const [{ now }] = await prisma.$queryRawUnsafe('SELECT NOW() as now');
        res.json({ ok: true, now });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

export default router;
