import { queryKeys } from './queryKeys';

export function invalidateBudgetData(queryClient, slug) {
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });

    if (!slug) return;

    queryClient.invalidateQueries({ queryKey: queryKeys.budgets.detail(slug) });
    queryClient.invalidateQueries({ queryKey: ['reports', slug] });
    queryClient.invalidateQueries({ queryKey: ['purchases', slug] });
    queryClient.invalidateQueries({ queryKey: ['budgets', 'detail', slug, 'purchases'] });
}

export function invalidateUserData(queryClient) {
    queryClient.invalidateQueries({ queryKey: queryKeys.auth.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.users.me });
    queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all });
}
