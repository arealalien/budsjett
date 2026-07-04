import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import './css/main.css';
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import { useUiStore } from "./stores/useUiStore";

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading, logout } = useAuth();
    const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const needsOnboarding = !!user?.needsOnboarding;
    const hasAppShell = !loading && user && !needsOnboarding;
    const appClassName = [
        hasAppShell ? "app-container user" : "app-container nouser",
        hasAppShell && sidebarCollapsed ? "sidebar-collapsed" : "",
    ].filter(Boolean).join(" ");

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

  return (
    <div className={appClassName}>
        <Navbar loading={loading} user={user} onboarding={needsOnboarding} handleLogout={handleLogout} />
        {user ? (
            <Sidebar loading={loading} user={user} onboarding={needsOnboarding} handleLogout={handleLogout} />
        ) : (
            <></>
        )}
        <Outlet />
    </div>
  );
}

export default App;
