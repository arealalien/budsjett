import React from "react";
import { NavLink } from "react-router-dom";
import Button from "../Button";

export default function Pricing() {
    return (
        <section className="landing-section">
            <div className="landing-section-header">
                <h3 className="landing-section-header-title">Pricing</h3>
            </div>
            <div className="landing-section-content">
                <div className="landing-section-content-pricing">
                    <div className="landing-section-content-pricing-card">
                        <div className="landing-section-content-pricing-card-rim"></div>
                        <div className="landing-section-content-pricing-card-glow tier-one"></div>
                        <div className="landing-section-content-pricing-card-inner">
                            <div className="landing-section-content-pricing-card-inner-top">
                                <p className="tier-one">Tier 1</p>
                                <h3>Purple</h3>
                                <ul>
                                    <li>Access to accounting app</li>
                                    <li>Invite 1 person to budget</li>
                                </ul>
                            </div>
                            <div className="landing-section-content-pricing-card-inner-bottom">
                                <p><span className="tier-one">€</span>1,99 <sub>/month</sub></p>
                                <Button className="ba-purple" children="Try 1 month free" />
                            </div>
                        </div>
                    </div>
                    <div className="landing-section-content-pricing-card">
                        <div className="landing-section-content-pricing-card-rim"></div>
                        <div className="landing-section-content-pricing-card-glow tier-two"></div>
                        <div className="landing-section-content-pricing-card-inner">
                            <div className="landing-section-content-pricing-card-inner-top">
                                <p className="tier-two">Tier 2</p>
                                <h3>Blue</h3>
                                <ul>
                                    <li>Access to accounting app</li>
                                    <li>Invite 3 people to each budget</li>
                                    <li>Ability to create more budgets</li>
                                </ul>
                            </div>
                            <div className="landing-section-content-pricing-card-inner-bottom">
                                <p><span className="tier-two">€</span>4,99 <sub>/month</sub></p>
                                <Button className="ba-primary" children="Try 1 month free" />
                            </div>
                        </div>
                    </div>
                    <div className="landing-section-content-pricing-card">
                        <div className="landing-section-content-pricing-card-rim"></div>
                        <div className="landing-section-content-pricing-card-glow tier-three"></div>
                        <div className="landing-section-content-pricing-card-inner">
                            <div className="landing-section-content-pricing-card-inner-top">
                                <p className="tier-three">Tier 3</p>
                                <h3>Pink</h3>
                                <ul>
                                    <li>Access to accounting app</li>
                                    <li>Invite 10 people to each budget</li>
                                    <li>Ability to create more budgets</li>
                                    <li>More freedom</li>
                                </ul>
                            </div>
                            <div className="landing-section-content-pricing-card-inner-bottom">
                                <p><span className="tier-three">€</span>6,99 <sub>/month</sub></p>
                                <Button className="ba-deeppink" children="Try 1 month free" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}