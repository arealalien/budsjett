import React from "react";
import { NavLink } from "react-router-dom";

export default function Header() {

    return (
        <header className="landing-header">
            <div className="landing-header-rim"></div>
            <div className="landing-header-glow"></div>
            <div className="landing-header-top">
                <h1 className="landing-header-top-title">Astrae is <span>your personal</span> accountant</h1>
                <p className="landing-header-top-subtitle">The accountant program for you</p>
            </div>
            <div className="landing-header-center">
                <NavLink to="/register">
                    <button className="shiny-cta">
                        <span>Try for free now</span>
                    </button>
                </NavLink>
            </div>
        </header>
    );
}