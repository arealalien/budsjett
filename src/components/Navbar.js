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
                            <svg xmlns="http://www.w3.org/2000/svg" id="Layer_2" data-name="Layer 2"
                                 viewBox="0 0 73.99 65.27">
                                <g id="Layer_1-2" data-name="Layer 1">
                                    <g>
                                        <path className="cls-1"
                                              d="M22.86,0h23.34l27.79,65.27h-23.64s-1.93-32.64,9.74-32.64c-11.67,0-37.24-32.64-37.24-32.64Z"/>
                                        <path className="cls-1" d="M7.16,41.28L0,65.27h17.38s4.9-20.92-10.21-23.99Z"/>
                                        <g>
                                            <path className="cls-1"
                                                  d="M59.41,32.61c.43.02.68.02.68.02,0,0-.25-.01-.68-.02Z"/>
                                            <path className="cls-1"
                                                  d="M59.41,32.61c-3.64-.14-21.07-.95-25.01-3.87-3.81-2.63-5.32-7.05-5.32-11.73h0c0,8.63-7,15.63-15.63,15.63h0c8.63,0,15.63,7,15.63,15.63h0c0-5.06,2.41-9.54,6.14-12.4,5.56-4.03,20.79-3.36,24.2-3.25Z"/>
                                        </g>
                                    </g>
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
