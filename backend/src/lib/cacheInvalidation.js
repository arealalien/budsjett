import { CACHE_TAGS, invalidateCacheTagsSoon } from './cache.js';

const unique = (items) => [...new Set(items.filter(Boolean))];

export function invalidateUserCaches(userId) {
    if (!userId) return { tags: 0 };

    const tags = [
        CACHE_TAGS.auth,
        CACHE_TAGS.user(userId),
        CACHE_TAGS.userBudgets(userId),
        CACHE_TAGS.userPurchases(userId),
    ];

    invalidateCacheTagsSoon(tags);

    return { tags: tags.length };
}

export function invalidateBudgetCaches({ budgetId, slug, userIds = [] } = {}) {
    const users = unique(userIds);

    const tags = [
        CACHE_TAGS.budgets,
        CACHE_TAGS.reports,
        CACHE_TAGS.purchases,
        budgetId && CACHE_TAGS.budget(budgetId),
        budgetId && CACHE_TAGS.budgetReports(budgetId),
        budgetId && CACHE_TAGS.budgetPurchases(budgetId),
        budgetId && CACHE_TAGS.budgetCategories(budgetId),
        budgetId && CACHE_TAGS.budgetMembers(budgetId),
        slug && CACHE_TAGS.budgetSlug(slug),
        ...users.flatMap((userId) => [
            CACHE_TAGS.user(userId),
            CACHE_TAGS.userBudgets(userId),
            CACHE_TAGS.userPurchases(userId),
        ]),
    ].filter(Boolean);

    invalidateCacheTagsSoon(tags);

    return { tags: tags.length };
}
