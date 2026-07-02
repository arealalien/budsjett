export const queryKeys = {
    auth: {
        me: ['auth', 'me'],
    },

    users: {
        me: ['users', 'me'],
    },

    budgets: {
        all: ['budgets'],
        list: () => ['budgets', 'list'],
        detail: (slug) => ['budgets', 'detail', slug],
        members: (slug) => ['budgets', 'detail', slug, 'members'],
        purchases: (slug, params) => ['budgets', 'detail', slug, 'purchases', params],
    },

    reports: {
        currentBalance: (slug, params) => ['reports', slug, 'current-balance', params],
        incomeTotals: (slug, params) => ['reports', slug, 'income-totals', params],
        categoryTotals: (slug, period) => ['reports', slug, 'category-totals', period],
        categoryTrend: (slug, period) => ['reports', slug, 'category-trend', period],
        spendingTrend: (slug, period) => ['reports', slug, 'spending-trend', period],
        analyticsOverview: (slug, period) => ['reports', slug, 'analytics-overview', period],
    },

    purchases: {
        detail: (slug, purchaseId) => ['purchases', slug, 'detail', purchaseId],
        timeline: (slug) => ['purchases', slug, 'timeline'],
    },

    notifications: {
        all: ['notifications'],
        list: (params) => ['notifications', 'list', params],
        unreadCount: ['notifications', 'unread-count'],
    },
};
