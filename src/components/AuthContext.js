import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageVersion, setImageVersion] = useState(Date.now());

    const fetchUser = async () => {
        try {
            const { data } = await api.get('/auth/me');
            setUser(data);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    const logout = async () => {
        await api.post('/auth/logout');
        setUser(null);
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