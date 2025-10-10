import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export async function verifyToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, name: true }
        });

        if (!user) return res.status(401).json({ error: 'Invalid token user' });

        req.user = user;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

export async function verifyTokenOptional(req, res, next) {
    const token = req.cookies.token;
    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, name: true }
        });

        req.user = user || null;
    } catch {
        req.user = null;
    }

    next();
}