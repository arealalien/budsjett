import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import './css/main.css';
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, loading, logout } = useAuth();

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (err) {
            console.error('Logout failed:', err);
        }
    };

    const needsOnboarding = !!user?.needsOnboarding;

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

  return (
    <div className={!loading && user && !user.needsOnboarding ? "app-container user" : "app-container"}>
        <Navbar loading={loading} user={user} onboarding={needsOnboarding} handleLogout={handleLogout} />
        <Sidebar loading={loading} user={user} onboarding={needsOnboarding} handleLogout={handleLogout} />
        <Outlet />
    </div>
  );
}

export default App;
