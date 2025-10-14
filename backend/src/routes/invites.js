import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { verifyToken } from '../middleware/auth.js';
import { canInvite } from '../lib/roles.js';

const router = Router();
router.use(verifyToken);

function urlSafeToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('base64url');
}
function inviteExpiry(days = 14) {
    return new Date(Date.now() + days*24*60*60*1000);
}


// POST /api/budgets/:slug/invites
const createInviteSchema = z.object({
    to: z.string().min(1), // username OR email
});

router.post('/budgets/:slug/invites', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { to } = createInviteSchema.parse(req.body);
        const me = req.user;

        // Load budget + my membership
        const budget = await prisma.budget.findFirst({
            where: {
                slug,
                OR: [
                    { ownerId: me.id },
                    { members: { some: { userId: me.id } } },
                ],
            },
            include: {
                owner: { select: { id: true, username: true, displayName: true } },
                members: true,
            },
        });
        if (!budget) return res.status(404).json({ error: 'Budget not found' });

        const myRole = budget.ownerId === me.id
            ? 'OWNER'
            : (budget.members.find(m => m.userId === me.id)?.role ?? 'MEMBER');

        if (!canInvite(myRole)) return res.status(403).json({ error: 'Not allowed to invite' });

        // Resolve "to" as existing user by username or email
        const targetUser = await prisma.user.findFirst({
            where: { OR: [{ username: to }, { email: to }] },
            select: { id: true, username: true, email: true },
        });

        if (targetUser) {
            // Already a member?
            const already = (budget.ownerId === targetUser.id) || budget.members.some(m => m.userId === targetUser.id);
            if (already) return res.status(409).json({ error: 'User is already a member' });

            const invite = await prisma.budgetInvite.create({
                data: {
                    budgetId: budget.id,
                    invitedUserId: targetUser.id,
                    invitedById: me.id,
                    status: 'PENDING',
                    token: urlSafeToken(32),
                    expiresAt: inviteExpiry(14),
                },
                select: { id: true, createdAt: true },
            });

            await prisma.notification.create({
                data: {
                    userId: targetUser.id,
                    type: 'INVITE',
                    inviteId: invite.id,
                    data: {
                        inviteId: invite.id,
                        budgetSlug: budget.slug,
                        budgetName: budget.name,
                        ownerUsername: budget.owner.username,
                    },
                },
            });

            return res.status(201).json({ ok: true });
        }

        // Otherwise store a “by email” invite (no app user yet)
        // (For MVP we still create an invite record but no notification.)
        const invite = await prisma.budgetInvite.create({
            data: {
                budgetId: budget.id,
                invitedEmail: to,
                invitedById: me.id,
                status: 'PENDING',
                token: urlSafeToken(32),
                expiresAt: inviteExpiry(14),
            },
            select: { id: true, createdAt: true },
        });

        return res.status(201).json({ ok: true, info: 'Invite created for email (no user yet)' });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ error: 'Invite already pending' });
        next(err);
    }
});

// POST /api/invites/:id/accept
router.post('/:id/accept', async (req, res, next) => {
    try {
        const me = req.user;
        const invite = await prisma.budgetInvite.findUnique({
            where: { id: req.params.id },
            include: { budget: true },
        });
        if (!invite || invite.status !== 'PENDING') return res.status(404).json({ error: 'Invite not found' });
        if (invite.invitedUserId !== me.id) return res.status(403).json({ error: 'Not your invite' });

        await prisma.$transaction(async (tx) => {
            const exists = await tx.budgetMember.findUnique({
                where: { budgetId_userId: { budgetId: invite.budgetId, userId: me.id } },
            });

            if (!exists) {
                await tx.budgetMember.create({
                    data: { budgetId: invite.budgetId, userId: me.id, role: 'MEMBER' },
                });
                try {
                    await tx.budgetInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
                } catch (e) {
                    // If there's already another ACCEPTED invite row due to a race / duplicate, ignore it
                    if (e.code !== 'P2002') throw e;
                }
            } else {
                // Already a member — make the invite accepted if still pending, but don’t explode on conflicts
                try {
                    await tx.budgetInvite.update({ where: { id: invite.id }, data: { status: 'ACCEPTED' } });
                } catch (e) {
                    if (e.code !== 'P2002') throw e;
                }
            }

            await tx.notification.updateMany({
                where: { userId: me.id, type: 'INVITE', inviteId: invite.id },
                data: { readAt: new Date() },
            });
        });

        res.json({ ok: true, slug: invite.budget.slug });
    } catch (err) { next(err); }
});


// POST /api/invites/:id/decline
router.post('/:id/decline', async (req, res, next) => {
    try {
        const me = req.user;
        const invite = await prisma.budgetInvite.findUnique({ where: { id: req.params.id } });
        if (!invite) return res.status(404).json({ error: 'Invite not found' });
        if (invite.invitedUserId !== me.id) return res.status(403).json({ error: 'Not your invite' });

        await prisma.$transaction(async (tx) => {
            if (invite.status === 'PENDING') {
                await tx.budgetInvite.update({ where: { id: invite.id }, data: { status: 'REVOKED' } });
            }
            // Mark related notifications read regardless of current status
            await tx.notification.updateMany({
                where: { userId: me.id, type: 'INVITE', inviteId: invite.id },
                data: { readAt: new Date() },
            });
        });

        res.json({ ok: true });
    } catch (err) { next(err); }
});


export default router;
