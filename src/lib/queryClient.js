import { QueryClient } from '@tanstack/react-query';

function shouldRetry(failureCount, error) {
    const status = error?.response?.status;
    if (status && status >= 400 && status < 500) return false;
    return failureCount < 1;
}

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: shouldRetry,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: false,
        },
    },
});
