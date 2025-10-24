import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import './css/main.css';
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";

function App() {
    const navigate = useNavigate();
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

  return (
    <div className={!loading && user && !user.needsOnboarding ? "app-container user" : "app-container"}>
        <Navbar loading={loading} user={user} onboarding={needsOnboarding} handleLogout={handleLogout} />
        <Sidebar loading={loading} user={user} onboarding={needsOnboarding} handleLogout={handleLogout} />
        <Outlet />
    </div>
  );
}

export default App;
