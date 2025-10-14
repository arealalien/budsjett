import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './components/AuthContext';
import './css/main.css';
import Button from "./components/Button";
import NotificationBell from "./components/NotificationBell";

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

  return (
    <div className="app-container">
        <nav className="navbar">
            <div className="navbar-inner view-width">
                <div className="navbar-inner-left">
                    <NavLink
                        to="/"
                        end
                        className={({isActive, isPending, isTransitioning}) =>
                            [
                                "navbar-inner-left-icon",
                                isPending ? "pending" : "",
                                isActive ? "active" : "",
                                isTransitioning ? "transitioning" : "",
                            ].join(" ")
                        }
                    >
                        <svg id="Layer_2" data-name="Layer 2" viewBox="0 0 162.9 177.2">
                            <g id="Layer_1-2" data-name="Layer 1">
                                <path className="cls-1"
                                      d="M145.62,81.81c-4.29-4.14-5.45-10.5-3.14-16,3.68-8.76,6.66-23.04-1.44-39.62C127.53-1.46,101.42.01,101.42.01H11.8C5.28.01,0,5.3,0,11.82l.03,73.99c0,12.15,9.95,21.8,22.06,20.73,13.14-1.16,21.38-14.42,22.38-30.47.28-4.45,5.78-6.33,8.69-2.95,9.7,11.28,17.56,13.95,35.27,12.25,4.69-.45,7.28,5.27,3.87,8.52-10.7,10.2-13.53,19.83-11.38,35.91.55,4.1-3.88,6.97-7.44,4.87-22.23-13.04-54.14-5.68-68.22,25.85-3.48,7.79,2.25,16.59,10.78,16.59h90.65s37.31,3.52,52.55-37.81c10.4-28.24-3.66-47.88-13.62-57.5Z"/>
                            </g>
                        </svg>
                    </NavLink>
                </div>
                <div className="navbar-inner-center">
                    {!loading && user && !user.needsOnboarding && (
                        <>
                            <NotificationBell />
                            <NavLink
                                to="/"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "navbar-inner-center-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="navbar-inner-center-link-icon" id="Xnix_Line_Dashboard" data-name="Xnix/Line/Dashboard" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M4.418,6H1.582A1.569,1.569,0,0,0,0,7.556v5.889A1.569,1.569,0,0,0,1.582,15H4.418A1.569,1.569,0,0,0,6,13.444V7.556A1.569,1.569,0,0,0,4.418,6Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M4.418,0H1.582A1.54,1.54,0,0,0,0,1.493V2.507A1.54,1.54,0,0,0,1.582,4H4.418A1.54,1.54,0,0,0,6,2.507V1.493A1.54,1.54,0,0,0,4.418,0Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-3" data-name="Vector" d="M9.582,9h2.835A1.569,1.569,0,0,0,14,7.444V1.556A1.569,1.569,0,0,0,12.418,0H9.582A1.569,1.569,0,0,0,8,1.556V7.444A1.569,1.569,0,0,0,9.582,9Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-4" data-name="Vector" d="M9.582,15h2.835A1.54,1.54,0,0,0,14,13.507V12.493A1.54,1.54,0,0,0,12.418,11H9.582A1.54,1.54,0,0,0,8,12.493v1.013A1.54,1.54,0,0,0,9.582,15Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="navbar-inner-center-link-title">Dashboard</span>
                            </NavLink>
                            <NavLink
                                to="/purchases"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "navbar-inner-center-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="navbar-inner-center-link-icon" id="Xnix_Line_list" data-name="Xnix/Line/list" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M2.086,12.982l-1.767.9a.22.22,0,0,1-.318-.2V.955A.936.936,0,0,1,.917,0h9.167A.936.936,0,0,1,11,.955V13.682a.22.22,0,0,1-.318.2l-1.767-.9a.216.216,0,0,0-.22.014l-1.422.966a.217.217,0,0,1-.244,0l-1.406-.955a.217.217,0,0,0-.244,0l-1.406.955a.217.217,0,0,1-.244,0L2.306,13A.216.216,0,0,0,2.086,12.982Z" transform="translate(6 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M2.5,7h6m-5,2h4m-4-4h4" transform="translate(6 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="navbar-inner-center-link-title">Purchases</span>
                            </NavLink>
                            <NavLink
                                to="/new"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "navbar-inner-center-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="navbar-inner-center-link-icon" id="Xnix_Line_Wallet" data-name="Xnix/Line/Wallet" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M13.927,8h-1.89a1.548,1.548,0,0,0,0,3.1h1.946M13.927,8A5.453,5.453,0,0,1,14,8.889v1.778q0,.216-.017.429M13.927,8a5.311,5.311,0,0,0-3.761-4.248M13.983,11.1A5.285,5.285,0,0,1,8.75,16H5.25A5.292,5.292,0,0,1,0,10.667V8.889A5.4,5.4,0,0,1,.33,7.025m9.837-3.273a5.178,5.178,0,0,0-1.417-.2H5.25A5.256,5.256,0,0,0,.33,7.025m9.837-3.273-.82-1.484A4.237,4.237,0,0,0,3.422.608L2.17,1.364A4.639,4.639,0,0,0,.33,7.025" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="navbar-inner-center-link-title">New Purchase</span>
                            </NavLink>
                            <NavLink
                                to="/budget"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "navbar-inner-center-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="navbar-inner-center-link-icon" id="Xnix_Line_Notes-lines-alt" data-name="Xnix/Line/Notes-lines-alt" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M4.308,0,9.829,0Q9.915,0,10,.011a4.3,4.3,0,0,1,4,4.275v6.429A4.3,4.3,0,0,1,9.692,15H4.308A4.3,4.3,0,0,1,0,10.714V4.286A4.3,4.3,0,0,1,4.308,0Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M14,4.286H10V.011M9,8H3M6,5H3m7,6H3" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="navbar-inner-center-link-title">Budget</span>
                            </NavLink>
                        </>
                    )}
                </div>
                <div className="navbar-inner-right">
                    {!user && (
                        <>
                            <NavLink
                                to="/signin"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <Button className="ba-white" children="Sign in" type="button" />
                            </NavLink>
                            <NavLink
                                to="/register"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <Button className="ba-purple" children="Register" type="button" />
                            </NavLink>
                        </>
                    )}
                    {!loading && user && (
                        <Button className="ba-white" children="Sign out" type="submit" onClick={handleLogout} />
                    )}
                </div>
            </div>
        </nav>
        <Outlet />
    </div>
  );
}

export default App;
