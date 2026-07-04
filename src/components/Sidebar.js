import React, { useState, useEffect } from 'react';
import { NavLink, useMatches } from "react-router-dom";
import useSidebarTransition from "./sidebar/useSidebarTransition";
import { useUiStore } from "../stores/useUiStore";

function useCurrentBudgetSlug() {
    const matches = useMatches();
    const match = matches.find(m => m.handle && m.handle.isBudgetRoute);
    return match?.params?.slug || null;
}

export default function Sidebar({ handleLogout, user }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const slug = useCurrentBudgetSlug();
    const preferredCollapsed = useUiStore((state) => state.sidebarCollapsed);
    const preferredWidth = useUiStore((state) => state.sidebarWidth);
    const setSidebarCollapsed = useUiStore((state) => state.setSidebarCollapsed);
    const setSidebarWidth = useUiStore((state) => state.setSidebarWidth);

    const {
        phase,
        isCollapsed: sidebarCollapsed,
        isResizing,
        toggle: toggleSidebar,
        sidebarStyle,
        iconStyle,
        iconHidden,
        isCompact,
        resizeHandleProps,
    } = useSidebarTransition({
        initialCollapsed: preferredCollapsed,
        initialOpenWidth: preferredWidth,
        onCollapsedChange: setSidebarCollapsed,
        onOpenWidthChange: setSidebarWidth,
        openWidth: "20em",
        closedWidth: "6em",
        minOpenWidth: "14em",
        maxOpenWidth: "32em",
        collapseThreshold: "10em",
        expandThreshold: "12em",
    });

    useEffect(() => {
        const buttons = document.querySelectorAll('.sidebar-menu-item-link');
        const handlers = [];

        buttons.forEach(btn => {
            const onClick = e => {
                const ripple = document.createElement('div');
                ripple.className = 'ripple';
                btn.appendChild(ripple);
                const { left, top } = btn.getBoundingClientRect();
                ripple.style.left = `${e.clientX - left}px`;
                ripple.style.top = `${e.clientY - top}px`;
                setTimeout(() => ripple.remove(), 600);
            }

            btn.addEventListener('click', onClick);
            handlers.push({ btn, onClick });
        })

        return () => {
            handlers.forEach(({ btn, onClick }) =>
                btn.removeEventListener('click', onClick)
            );
        };
    }, [user]);

    useEffect(() => {
        if (!menuOpen) return;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setMenuOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [menuOpen]);

    const budgetHref = (suffix = '') => (slug ? `/${slug}${suffix}` : '/budgets');

    const needsBudget = !slug;

    const maybeBlock = (e) => {
        if (needsBudget) {
            e.preventDefault();
        }
    };

    return  (
        <div className={`sidebar ${isCompact ? 'is-collapsed' : ''} ${isResizing ? 'is-resizing' : ''}`}
             style={sidebarStyle}
             data-phase={phase}
        >
            <div className="sidebar-resize-handle" {...resizeHandleProps} />
            <div className="sidebar-top"
                 style={{
                     justifyContent: isCompact ? "center" : "space-between",
                 }}
            >
                <NavLink
                    className="sidebar-top-icon"
                    to="/"
                    style={{
                        ...iconStyle,
                        display: iconHidden ? "none" : "inline-block",
                    }}
                >
                    <svg className="sidebar-inner-top-header-left-logo" id="Layer_2" data-name="Layer 2"
                         viewBox="0 0 73.99 65.27">
                        <g id="Layer_1-2" data-name="Layer 1">
                            <g>
                                <path className="cls-1"
                                      d="M22.86,0h23.34l27.79,65.27h-23.64s-1.93-32.64,9.74-32.64c-11.67,0-37.24-32.64-37.24-32.64Z"></path>
                                <path className="cls-1" d="M7.16,41.28L0,65.27h17.38s4.9-20.92-10.21-23.99Z"></path>
                                <g>
                                    <path className="cls-1"
                                          d="M59.41,32.61c.43.02.68.02.68.02,0,0-.25-.01-.68-.02Z"></path>
                                    <path className="cls-1"
                                          d="M59.41,32.61c-3.64-.14-21.07-.95-25.01-3.87-3.81-2.63-5.32-7.05-5.32-11.73h0c0,8.63-7,15.63-15.63,15.63h0c8.63,0,15.63,7,15.63,15.63h0c0-5.06,2.41-9.54,6.14-12.4,5.56-4.03,20.79-3.36,24.2-3.25Z"></path>
                                </g>
                            </g>
                        </g>
                    </svg>
                </NavLink>
                <div className="sidebar-toggle"
                     onClick={toggleSidebar}
                     aria-pressed={sidebarCollapsed}>
                    {sidebarCollapsed ? (
                        <span className="material-symbols-rounded">left_panel_open</span>
                    ) : (
                        <span className="material-symbols-rounded">left_panel_close</span>
                    )}
                </div>
            </div>
            <div className="sidebar-center">
                <ul className="sidebar-menu">
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('')}
                            end
                            className={({isActive, isPending, isTransitioning}) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">home</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Dashboard</span>
                            )}
                        </NavLink>
                    </li>
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/new')}
                            end
                            className={({isActive, isPending, isTransitioning}) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">add</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>New purchase</span>
                            )}
                        </NavLink>
                    </li>
                </ul>
                <div className="sidebar-divider"></div>
                <ul className="sidebar-menu">
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/analytics')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">analytics</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Analytics</span>
                            )}
                        </NavLink>
                    </li>
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/statistics')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">area_chart</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Statistics</span>
                            )}
                        </NavLink>
                    </li>
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/purchases')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">receipt_long</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Purchases</span>
                            )}
                        </NavLink>
                    </li>
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/reports')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">docs</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Reports</span>
                            )}
                        </NavLink>
                        {isCompact ? (
                            <></>
                        ) : (
                            <p className="sidebar-menu-item-button">
                                <span className="material-symbols-rounded">keyboard_arrow_down</span>
                            </p>
                        )}
                    </li>
                </ul>
                <div className="sidebar-divider"></div>
                <ul className="sidebar-menu">
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/members')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">groups_2</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Budget members</span>
                            )}
                        </NavLink>
                        {isCompact ? (
                            <></>
                        ) : (
                            <p className="sidebar-menu-item-button">
                                <span className="material-symbols-rounded">keyboard_arrow_down</span>
                            </p>
                        )}
                    </li>
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/edit')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">rebase_edit</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Edit budget</span>
                            )}
                        </NavLink>
                    </li>
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/settings')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">settings</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Budget settings</span>
                            )}
                        </NavLink>
                    </li>
                </ul>
                <div className="sidebar-divider"></div>
                <ul className="sidebar-menu">
                    <li className="sidebar-menu-item">
                        <NavLink
                            to={budgetHref('/account/settings')}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-item-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <span className="material-symbols-rounded">settings</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Account settings</span>
                            )}
                        </NavLink>
                    </li>
                </ul>
                <div className="sidebar-divider"></div>
            </div>
            <div className="sidebar-bottom">
                <ul className="sidebar-menu">
                    <li className="sidebar-menu-item">
                        <div className="sidebar-menu-item-link sidebar-logout" onClick={handleLogout}>
                            <span className="material-symbols-rounded">logout</span>
                            {isCompact ? (
                                <></>
                            ) : (
                                <span>Log out</span>
                            )}
                        </div>
                    </li>
                </ul>
            </div>
        </div>
    );
}
