import React from "react";
import { NavLink } from "react-router-dom";
import Button from "../Button";

export default function Header() {
    return (
        <header className="landing-header">
            <div className="landing-header-rim"></div>
            <div className="landing-header-glow"></div>
            <div className="landing-header-top">
                <h1 className="landing-header-top-title">Budget is <span>your personal</span> accountant</h1>
                <p className="landing-header-top-subtitle">The accountant program for you</p>
            </div>
            <div className="landing-header-center">
                <NavLink to="/register">
                    <Button className="ba-purple" children="Try for free now" />
                </NavLink>
                <NavLink to="/signin">
                    <Button className="ba-white" children="Sign in" />
                </NavLink>
            </div>
        </header>
    );
}