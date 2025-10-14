import { Router } from 'express';
import { z } from 'zod';
import { verifyToken } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';

const router = Router();
router.use(verifyToken);

const listSchema = z.object({
    onlyUnread: z.coerce.boolean().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
});

router.get('/', async (req, res, next) => {
    try {
        const { onlyUnread, page, pageSize } = listSchema.parse(req.query);
        const where = { userId: req.user.id, ...(onlyUnread ? { readAt: null } : {}) };

        const [total, items] = await Promise.all([
            prisma.notification.count({ where }),
            prisma.notification.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        res.json({ total, items });
    } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
    try {
        const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
        if (!n || n.userId !== req.user.id) return res.status(403).json({ error: 'No access' });
        await prisma.notification.update({
            where: { id: req.params.id },
        data: { readAt: new Date() },
        });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

router.get('/unread-count', async (req, res, next) => {
    try {
        const c = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
        res.json({ count: c });
    } catch (e) { next(e); }
});

export default router;
