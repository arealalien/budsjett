import { prisma } from '../lib/prisma.js';

export async function canAccessPurchase(req, res, next) {
    const id = req.params.id;
    const p = await prisma.purchase.findUnique({
        where: { id },
        select: { shared: true, paidById: true },
    });
    if (!p) return res.status(404).json({ error: 'Not found' });

    const allowed = p.shared || p.paidById === req.user.id;
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    next();
}