import React from 'react';
import { NavLink } from "react-router-dom";
import Button from "./Button";

export default function Navbar({ loading, user, onboarding = false, handleLogout }) {

    return (
        !loading && !user && (
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
        )
    );
}
