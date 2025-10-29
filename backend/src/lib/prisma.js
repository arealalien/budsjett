import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        // helpful in dev; in prod you can keep only 'error'
        log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error', 'warn'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;