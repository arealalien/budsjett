import { createContext, useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [imageVersion, setImageVersion] = useState(Date.now());
    const queryClient = useQueryClient();

    const { data: user = null, isLoading: loading } = useQuery({
        queryKey: queryKeys.auth.me,
        queryFn: async () => {
            try {
                const { data } = await api.get('/auth/me');
                return data;
            } catch {
                return null;
            }
        },
        staleTime: 60_000,
    });

    const logout = async () => {
        await api.post('/auth/logout');
        queryClient.setQueryData(queryKeys.auth.me, null);
        queryClient.removeQueries({ queryKey: queryKeys.budgets.all });
    };

    const setUser = (nextUserOrUpdater) => {
        queryClient.setQueryData(queryKeys.auth.me, (previous) => (
            typeof nextUserOrUpdater === 'function'
                ? nextUserOrUpdater(previous)
                : nextUserOrUpdater
        ));
    };

    const bumpImageVersion = () => {
        setImageVersion(Date.now());
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                loading,
                logout,
                imageVersion,
                bumpImageVersion
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
