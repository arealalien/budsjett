import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function RequireOnboarding({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null; // or spinner
    if (!user) return <Navigate to="/signin" replace />;
    if (user.needsOnboarding) return children; // allow onboarding page
    return <Navigate to="/" replace />;
}

// RequireApp.jsx — block app until onboarding done
export function RequireApp({ children }) {
    const { user, loading } = useAuth();
    if (loading) return null;
    if (!user) return <Navigate to="/signin" replace />;
    if (user.needsOnboarding) return <Navigate to="/onboarding" replace />;
    return children;
}
