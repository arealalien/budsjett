import React from 'react';
import { NavLink, useMatches } from "react-router-dom";
import NotificationBell from "./NotificationBell";

export default function Sidebar({ loading, user, onboarding = false, handleLogout }) {
    const matches = useMatches();
    const budgetMatch = matches.find(m => m.handle?.isBudgetRoute);
    const slug = budgetMatch?.params?.slug;
    const onBudgetPage = Boolean(budgetMatch);

    const showLeft  = !loading && user && !onboarding;
    const showRight = showLeft && onBudgetPage;

    const budgetBase = slug ? `/${slug}` : null;

    return (
        <div className="sidebar">
            {showLeft && (
                <div className="sidebar-left">
                    <div className="sidebar-left-inner">
                        <div className="sidebar-left-inner-top">
                            <NavLink
                                to="/"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "sidebar-left-inner-icon",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <div className="sidebar-left-inner-icon-inner">
                                    <svg id="Layer_2" data-name="Layer 2" viewBox="0 0 162.9 177.2">
                                        <g id="Layer_1-2" data-name="Layer 1">
                                            <path className="cls-1"
                                                  d="M145.62,81.81c-4.29-4.14-5.45-10.5-3.14-16,3.68-8.76,6.66-23.04-1.44-39.62C127.53-1.46,101.42.01,101.42.01H11.8C5.28.01,0,5.3,0,11.82l.03,73.99c0,12.15,9.95,21.8,22.06,20.73,13.14-1.16,21.38-14.42,22.38-30.47.28-4.45,5.78-6.33,8.69-2.95,9.7,11.28,17.56,13.95,35.27,12.25,4.69-.45,7.28,5.27,3.87,8.52-10.7,10.2-13.53,19.83-11.38,35.91.55,4.1-3.88,6.97-7.44,4.87-22.23-13.04-54.14-5.68-68.22,25.85-3.48,7.79,2.25,16.59,10.78,16.59h90.65s37.31,3.52,52.55-37.81c10.4-28.24-3.66-47.88-13.62-57.5Z"/>
                                        </g>
                                    </svg>
                                </div>
                            </NavLink>
                            <ul className="sidebar-left-inner-list">
                                <li className="sidebar-left-inner-list-item">
                                    <NavLink
                                        to="/"
                                        end
                                        className={({isActive, isPending, isTransitioning}) =>
                                            [
                                                "sidebar-left-inner-list-item-link",
                                                isPending ? "pending" : "",
                                                isActive ? "active" : "",
                                                isTransitioning ? "transitioning" : "",
                                            ].join(" ")
                                        }
                                    >
                                        <svg className="sidebar-left-inner-list-item-link-icon" id="Xnix_Line_Home_11" data-name="Xnix/Line/Home 11" width="24" height="24" viewBox="0 0 24 24">
                                            <path id="Vector" d="M6.118,6.358A1.883,1.883,0,1,1,8,8.268,1.9,1.9,0,0,1,6.118,6.358Z" transform="translate(4 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            <path id="Vector-2" data-name="Vector" d="M0,4.447l4.743-3.4a5.579,5.579,0,0,1,6.513,0L16,4.447M1.882,6.358v3.821A3.793,3.793,0,0,0,5.647,14h4.706a3.793,3.793,0,0,0,3.765-3.821V6.358" transform="translate(4 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                    </NavLink>
                                </li>
                                <li className="sidebar-left-inner-list-item">
                                    <NavLink
                                        to="/budgets"
                                        end
                                        className={({isActive, isPending, isTransitioning}) =>
                                            [
                                                "sidebar-left-inner-list-item-link",
                                                isPending ? "pending" : "",
                                                isActive ? "active" : "",
                                                onBudgetPage ? "active" : "",
                                                isTransitioning ? "transitioning" : "",
                                            ].join(" ")
                                        }
                                    >
                                        <svg className="sidebar-left-inner-list-item-link-icon" id="Xnix_Line_poll" data-name="Xnix/Line/poll" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                            <path id="Vector" d="M9.692,0H4.308A4.321,4.321,0,0,0,0,4.333V8.667A4.321,4.321,0,0,0,4.308,13H9.692A4.321,4.321,0,0,0,14,8.667V4.333A4.321,4.321,0,0,0,9.692,0Z" transform="translate(5.5 5.5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            <path id="Vector-2" data-name="Vector" d="M3.5,9.5v-4M7,9.5v-6m3.5,6v-4" transform="translate(5.5 5.5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                    </NavLink>
                                </li>
                                <li className="sidebar-left-inner-list-item">
                                    <NavLink
                                        to="/profile"
                                        end
                                        className={({isActive, isPending, isTransitioning}) =>
                                            [
                                                "sidebar-left-inner-list-item-link",
                                                isPending ? "pending" : "",
                                                isActive ? "active" : "",
                                                isTransitioning ? "transitioning" : "",
                                            ].join(" ")
                                        }
                                    >
                                        <svg className="sidebar-left-inner-list-item-link-icon" id="Xnix_Line_User_8" data-name="Xnix/Line/User 8" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                            <path id="Vector" d="M7,2A2,2,0,1,1,5,0,2,2,0,0,1,7,2Z" transform="translate(7 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            <path id="Vector-2" data-name="Vector" d="M10,10.5C10,12.433,7.761,14,5,14s-5-1.567-5-3.5S2.239,7,5,7,10,8.567,10,10.5Z" transform="translate(7 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                    </NavLink>
                                </li>
                                <li className="sidebar-left-inner-list-item">
                                    <NavLink
                                        to="/settings"
                                        end
                                        className={({isActive, isPending, isTransitioning}) =>
                                            [
                                                "sidebar-left-inner-list-item-link",
                                                isPending ? "pending" : "",
                                                isActive ? "active" : "",
                                                isTransitioning ? "transitioning" : "",
                                            ].join(" ")
                                        }
                                    >
                                        <svg className="sidebar-left-inner-list-item-link-icon" id="Xnix_Line_Setting_5" data-name="Xnix/Line/Setting 5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                            <path id="Vector" d="M6.3,14a.749.749,0,0,1-.739-.627.812.812,0,0,0-.549-.623,5.905,5.905,0,0,1-.676-.28.8.8,0,0,0-.816.052.736.736,0,0,1-.95-.077l-.992-.992a.772.772,0,0,1-.082-.995.839.839,0,0,0,.064-.837,5.8,5.8,0,0,1-.226-.576.865.865,0,0,0-.667-.6A.792.792,0,0,1,0,7.669V6.428a.908.908,0,0,1,.76-.9A1,1,0,0,0,1.5,4.921q.057-.133.12-.264a1,1,0,0,0-.061-1.024.906.906,0,0,1,.094-1.169l.729-.729a1.039,1.039,0,0,1,1.34-.11l.023.016a1.1,1.1,0,0,0,1.044.1A1.106,1.106,0,0,0,5.5.912L5.51.878A1.046,1.046,0,0,1,6.542,0h.88A1.076,1.076,0,0,1,8.484.9L8.5.97a1.071,1.071,0,0,0,.676.8,1.07,1.07,0,0,0,1.026-.1l.05-.036a1.066,1.066,0,0,1,1.377.111l.671.672a.975.975,0,0,1,.1,1.257,1.086,1.086,0,0,0-.073,1.089l.043.1a1.092,1.092,0,0,0,.806.658A.982.982,0,0,1,14,6.487V7.6a.866.866,0,0,1-.724.854.953.953,0,0,0-.729.648q-.07.2-.156.4a.919.919,0,0,0,.078.9.839.839,0,0,1-.088,1.083l-.931.932a.769.769,0,0,1-.992.081.836.836,0,0,0-.86-.05,5.909,5.909,0,0,1-.6.257.84.84,0,0,0-.552.641A.773.773,0,0,1,7.688,14Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            <path id="Vector-2" data-name="Vector" d="M9.333,7A2.333,2.333,0,1,1,7,4.667,2.333,2.333,0,0,1,9.333,7Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                    </NavLink>
                                </li>
                            </ul>
                        </div>
                        <div className="sidebar-left-inner-bottom">
                            <NotificationBell />
                            <button className="sidebar-left-inner-button" onClick={handleLogout}>
                                <div className="sidebar-left-inner-button-inner">
                                    <svg id="Xnix_Line_Left_Arrow_Alt" data-name="Xnix/Line/Left Arrow Alt" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                        <path id="Vector_638" data-name="Vector 638" d="M4.131,0,0,4.124m0,0L4.131,8M0,4.124H10.37A3.619,3.619,0,0,1,14,7.733" transform="translate(5 8)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    </svg>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showRight && (
                <div className="sidebar-right">
                    <div className="sidebar-right-inner">
                        <div className="sidebar-right-inner-top">
                            <div className="sidebar-right-inner-top-dock">
                                <div className="sidebar-right-inner-top-dock-left">
                                    <h3 className="sidebar-right-inner-top-dock-left-title">Dashboard</h3>
                                </div>
                                <div className="sidebar-right-inner-top-dock-right">
                                    <button className="sidebar-right-inner-top-dock-right-button">
                                        <svg id="Xnix_Line_Dice" data-name="Xnix/Line/Dice" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12">
                                            <path id="Union_48" data-name="Union 48" d="M0,1a1,1,0,1,1,.293.707A1,1,0,0,1,0,1Z" transform="translate(0)"/>
                                            <path id="Union_48-2" data-name="Union 48" d="M0,1a1,1,0,1,1,.293.707A1,1,0,0,1,0,1Z" transform="translate(5)"/>
                                            <path id="Union_50" data-name="Union 50" d="M0-1a1,1,0,0,0,.169.556,1,1,0,0,0,.449.368A1,1,0,0,0,1.2-.019a1,1,0,0,0,.512-.274A1,1,0,0,0,1.981-.8a1,1,0,0,0-.057-.578,1,1,0,0,0-.368-.449A1,1,0,0,0,1-2a1,1,0,0,0-.707.293A1,1,0,0,0,0-1Z" transform="translate(5 7)"/>
                                            <path id="Union_50-2" data-name="Union 50" d="M0-1a1,1,0,0,0,.169.556,1,1,0,0,0,.449.368A1,1,0,0,0,1.2-.019a1,1,0,0,0,.512-.274A1,1,0,0,0,1.981-.8a1,1,0,0,0-.057-.578,1,1,0,0,0-.368-.449A1,1,0,0,0,1-2a1,1,0,0,0-.707.293A1,1,0,0,0,0-1Z" transform="translate(0 7)"/>
                                            <path id="Union_50-3" data-name="Union 50" d="M0-1a1,1,0,0,0,.169.556,1,1,0,0,0,.449.368A1,1,0,0,0,1.2-.019a1,1,0,0,0,.512-.274A1,1,0,0,0,1.981-.8a1,1,0,0,0-.057-.578,1,1,0,0,0-.368-.449A1,1,0,0,0,1-2a1,1,0,0,0-.707.293A1,1,0,0,0,0-1Z" transform="translate(5 12)"/>
                                            <path id="Union_50-4" data-name="Union 50" d="M0-1a1,1,0,0,0,.169.556,1,1,0,0,0,.449.368A1,1,0,0,0,1.2-.019a1,1,0,0,0,.512-.274A1,1,0,0,0,1.981-.8a1,1,0,0,0-.057-.578,1,1,0,0,0-.368-.449A1,1,0,0,0,1-2a1,1,0,0,0-.707.293A1,1,0,0,0,0-1Z" transform="translate(10 7)"/>
                                            <path id="Union_51" data-name="Union 51" d="M0,1A1,1,0,1,0,.293.293,1,1,0,0,0,0,1Z" transform="translate(12 2) rotate(180)"/>
                                            <path id="Union_52" data-name="Union 52" d="M0,1a1,1,0,1,1,.293.707A1,1,0,0,1,0,1Z" transform="translate(12 12) rotate(180)"/>
                                            <path id="Union_49" data-name="Union 49" d="M0-1a1,1,0,0,0,.169.556,1,1,0,0,0,.449.368A1,1,0,0,0,1.2-.019a1,1,0,0,0,.512-.274A1,1,0,0,0,1.981-.8a1,1,0,0,0-.057-.578,1,1,0,0,0-.368-.449A1,1,0,0,0,1-2a1,1,0,0,0-.707.293A1,1,0,0,0,0-1Z" transform="translate(0 12)"/>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="sidebar-right-inner-top-center">
                                <div className="sidebar-right-inner-top-current">
                                    <div className="sidebar-right-inner-top-current-item">
                                        <div className="sidebar-right-inner-top-current-item-glow"></div>
                                        <div className="sidebar-right-inner-top-current-item-inner">
                                            <div className="sidebar-right-inner-top-current-item-left">
                                                <div className="sidebar-right-inner-top-current-item-left-icon">
                                                    <div className="sidebar-right-inner-top-current-item-left-icon-inner">
                                                        M
                                                    </div>
                                                </div>
                                                <h3 className="sidebar-right-inner-top-current-item-left-title">{budgetBase}</h3>
                                            </div>
                                            <div className="sidebar-right-inner-top-current-item-right">
                                                <div className="sidebar-right-inner-top-current-item-right-button">
                                                    <svg id="Xnix_Line_Sort_1" data-name="Xnix/Line/Sort 1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                        <path id="Vector" d="M.234,4.19,3.1.4A.942.942,0,0,1,4.635.4L7.768,4.19A1.117,1.117,0,0,1,7,6H1A1.117,1.117,0,0,1,.234,4.19Z" transform="translate(8 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                        <path id="Vector-2" data-name="Vector" d="M7.768,9.81,4.9,13.6a.942.942,0,0,1-1.536,0L.234,9.81A1.117,1.117,0,0,1,1,8H7A1.117,1.117,0,0,1,7.768,9.81Z" transform="translate(8 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="sidebar-right-inner-top-current-dropdown">
                                        <div className="sidebar-right-inner-top-current-dropdown-item">
                                            <div className="sidebar-right-inner-top-current-dropdown-item-left">
                                                <div className="sidebar-right-inner-top-current-dropdown-item-left-icon">
                                                    <div className="sidebar-right-inner-top-current-dropdown-item-left-icon-inner">
                                                        M
                                                    </div>
                                                </div>
                                                <h3 className="sidebar-right-inner-top-current-dropdown-item-left-title">{budgetBase}</h3>
                                            </div>
                                            <div className="sidebar-right-inner-top-current-dropdown-item-right">
                                                <div className="sidebar-right-inner-top-current-dropdown-item-right-button">
                                                    <svg id="Xnix_Line_Tick" data-name="Xnix/Line/Tick" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                        <path id="Vector" d="M0,4.5,4.667,9,14,0" transform="translate(5 7)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="sidebar-right-inner-top-current-dropdown-item">
                                            <div className="sidebar-right-inner-top-current-dropdown-item-left">
                                                <div className="sidebar-right-inner-top-current-dropdown-item-left-icon">
                                                    <div className="sidebar-right-inner-top-current-dropdown-item-left-icon-inner">
                                                        M
                                                    </div>
                                                </div>
                                                <h3 className="sidebar-right-inner-top-current-dropdown-item-left-title">{budgetBase}</h3>
                                            </div>
                                            <div className="sidebar-right-inner-top-current-dropdown-item-right">
                                                <div className="sidebar-right-inner-top-current-dropdown-item-right-button">
                                                    <svg id="Xnix_Line_Tick" data-name="Xnix/Line/Tick" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                        <path id="Vector" d="M0,4.5,4.667,9,14,0" transform="translate(5 7)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <ul className="sidebar-right-inner-top-list">
                                    <li className="sidebar-right-inner-top-list-item">
                                        <NavLink
                                            to={`${budgetBase}/new`}
                                            end
                                            className={({isActive, isPending, isTransitioning}) =>
                                                [
                                                    "sidebar-right-inner-top-list-item-link",
                                                    isPending ? "pending" : "",
                                                    isActive ? "active" : "",
                                                    isTransitioning ? "transitioning" : "",
                                                ].join(" ")
                                            }
                                        >
                                            <svg className="sidebar-right-inner-top-list-item-link-icon" id="Xnix_Line_Add" data-name="Xnix/Line/Add" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                <path id="Vector" d="M0,5H5M5,5h5M5,5s0,0,0,5M5,5V0" transform="translate(7 7)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            </svg>
                                            <span className="sidebar-right-inner-top-list-item-link-label">New purchase</span>
                                        </NavLink>
                                    </li>
                                    <li className="sidebar-right-inner-top-list-item">
                                        <NavLink
                                            to={`${budgetBase}`}
                                            end
                                            className={({isActive, isPending, isTransitioning}) =>
                                                [
                                                    "sidebar-right-inner-top-list-item-link",
                                                    isPending ? "pending" : "",
                                                    isActive ? "active" : "",
                                                    isTransitioning ? "transitioning" : "",
                                                ].join(" ")
                                            }
                                        >
                                            <svg className="sidebar-right-inner-top-list-item-link-icon" id="Xnix_Line_Dashboard_3" data-name="Xnix/Line/Dashboard 3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                <path id="Rectangle_1466" data-name="Rectangle 1466" d="M10,14H4a4,4,0,0,1-4-4V6m10,8a4,4,0,0,0,4-4V6m-4,8V6M7,0H4A4,4,0,0,0,0,4V6M7,0h3a4,4,0,0,1,4,4V6M7,0V6M7,6H0M7,6h3m4,0H10" transform="translate(5 19) rotate(-90)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            </svg>
                                            <span className="sidebar-right-inner-top-list-item-link-label">Dashboard</span>
                                        </NavLink>
                                    </li>
                                    <li className="sidebar-right-inner-top-list-item">
                                        <NavLink
                                            to={`${budgetBase}/purchases`}
                                            end
                                            className={({isActive, isPending, isTransitioning}) =>
                                                [
                                                    "sidebar-right-inner-top-list-item-link",
                                                    isPending ? "pending" : "",
                                                    isActive ? "active" : "",
                                                    isTransitioning ? "transitioning" : "",
                                                ].join(" ")
                                            }
                                        >
                                            <svg className="sidebar-right-inner-top-list-item-link-icon" id="Xnix_Line_Wallet" data-name="Xnix/Line/Wallet" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                <path id="Vector" d="M13.927,8h-1.89a1.548,1.548,0,0,0,0,3.1h1.946M13.927,8A5.453,5.453,0,0,1,14,8.889v1.778q0,.216-.017.429M13.927,8a5.311,5.311,0,0,0-3.761-4.248M13.983,11.1A5.285,5.285,0,0,1,8.75,16H5.25A5.292,5.292,0,0,1,0,10.667V8.889A5.4,5.4,0,0,1,.33,7.025m9.837-3.273a5.178,5.178,0,0,0-1.417-.2H5.25A5.256,5.256,0,0,0,.33,7.025m9.837-3.273-.82-1.484A4.237,4.237,0,0,0,3.422.608L2.17,1.364A4.639,4.639,0,0,0,.33,7.025" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            </svg>
                                            <span className="sidebar-right-inner-list-item-link-label">Purchases</span>
                                        </NavLink>
                                    </li>
                                    <li className="sidebar-right-inner-top-list-item">
                                        <NavLink
                                            to={`${budgetBase}/members`}
                                            end
                                            className={({isActive, isPending, isTransitioning}) =>
                                                [
                                                    "sidebar-right-inner-top-list-item-link",
                                                    isPending ? "pending" : "",
                                                    isActive ? "active" : "",
                                                    isTransitioning ? "transitioning" : "",
                                                ].join(" ")
                                            }
                                        >
                                            <svg className="sidebar-right-inner-top-list-item-link-icon" id="Xnix_Line_Users_3" data-name="Xnix/Line/Users 3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                <path id="Vector" d="M7,2.333A2.333,2.333,0,1,1,4.667,0,2.333,2.333,0,0,1,7,2.333Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                <path id="Vector-2" data-name="Vector" d="M9.333,10.733c0,1.8-2.089,3.267-4.667,3.267S0,12.537,0,10.733,2.089,7.467,4.667,7.467,9.333,8.929,9.333,10.733Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                <path id="Vector-3" data-name="Vector" d="M11.939,4.511a1.4,1.4,0,1,1-1.4-1.4A1.4,1.4,0,0,1,11.939,4.511Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                <path id="Vector-4" data-name="Vector" d="M11.2,13.067A2.6,2.6,0,0,0,14,10.733,2.6,2.6,0,0,0,11.2,8.4" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            </svg>
                                            <span className="sidebar-right-inner-list-item-link-label">Members</span>
                                        </NavLink>
                                    </li>
                                    <li className="sidebar-right-inner-top-list-item">
                                        <NavLink
                                            to={`${budgetBase}/edit`}
                                            end
                                            className={({isActive, isPending, isTransitioning}) =>
                                                [
                                                    "sidebar-right-inner-top-list-item-link",
                                                    isPending ? "pending" : "",
                                                    isActive ? "active" : "",
                                                    isTransitioning ? "transitioning" : "",
                                                ].join(" ")
                                            }
                                        >
                                            <svg className="sidebar-right-inner-top-list-item-link-icon" id="Xnix_Line_Setting_5" data-name="Xnix/Line/Setting 5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                                <path id="Vector" d="M6.3,14a.749.749,0,0,1-.739-.627.812.812,0,0,0-.549-.623,5.905,5.905,0,0,1-.676-.28.8.8,0,0,0-.816.052.736.736,0,0,1-.95-.077l-.992-.992a.772.772,0,0,1-.082-.995.839.839,0,0,0,.064-.837,5.8,5.8,0,0,1-.226-.576.865.865,0,0,0-.667-.6A.792.792,0,0,1,0,7.669V6.428a.908.908,0,0,1,.76-.9A1,1,0,0,0,1.5,4.921q.057-.133.12-.264a1,1,0,0,0-.061-1.024.906.906,0,0,1,.094-1.169l.729-.729a1.039,1.039,0,0,1,1.34-.11l.023.016a1.1,1.1,0,0,0,1.044.1A1.106,1.106,0,0,0,5.5.912L5.51.878A1.046,1.046,0,0,1,6.542,0h.88A1.076,1.076,0,0,1,8.484.9L8.5.97a1.071,1.071,0,0,0,.676.8,1.07,1.07,0,0,0,1.026-.1l.05-.036a1.066,1.066,0,0,1,1.377.111l.671.672a.975.975,0,0,1,.1,1.257,1.086,1.086,0,0,0-.073,1.089l.043.1a1.092,1.092,0,0,0,.806.658A.982.982,0,0,1,14,6.487V7.6a.866.866,0,0,1-.724.854.953.953,0,0,0-.729.648q-.07.2-.156.4a.919.919,0,0,0,.078.9.839.839,0,0,1-.088,1.083l-.931.932a.769.769,0,0,1-.992.081.836.836,0,0,0-.86-.05,5.909,5.909,0,0,1-.6.257.84.84,0,0,0-.552.641A.773.773,0,0,1,7.688,14Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                <path id="Vector-2" data-name="Vector" d="M9.333,7A2.333,2.333,0,1,1,7,4.667,2.333,2.333,0,0,1,9.333,7Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            </svg>
                                            <span className="sidebar-right-inner-list-item-link-label">Edit Budget</span>
                                        </NavLink>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="sidebar-right-inner-bottom">
                            <div className="sidebar-right-inner-bottom-users">
                                <div className="sidebar-right-inner-bottom-users-inner">

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
