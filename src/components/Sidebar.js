import React from 'react';
import { NavLink, useMatches } from "react-router-dom";

function useCurrentBudgetSlug() {
    const matches = useMatches();
    const match = matches.find(m => m.handle && m.handle.isBudgetRoute);
    return match?.params?.slug || null;
}

export default function Sidebar({ handleLogout }) {
    const slug = useCurrentBudgetSlug();

    const budgetHref = (suffix = '') => (slug ? `/${slug}${suffix}` : '/budgets');

    const needsBudget = !slug;

    const linkClass = ({ isActive, isPending, isTransitioning }, extra = '') =>
        [
            'sidebar-inner-center-list-item-link',
            isPending ? 'pending' : '',
            isActive ? 'active' : '',
            isTransitioning ? 'transitioning' : '',
            extra,
        ]
            .filter(Boolean)
            .join(' ');

    const maybeBlock = (e) => {
        if (needsBudget) {
            e.preventDefault();
        }
    };

    return  (
        <div className="sidebar">
            <div className="sidebar-inner">
                <div className="sidebar-inner-top">
                    <div className="sidebar-inner-top-header">
                        <div className="sidebar-inner-top-header-left">
                            <svg className="sidebar-inner-top-header-left-logo" id="Layer_2" data-name="Layer 2"
                                 viewBox="0 0 73.99 65.27">
                                <g id="Layer_1-2" data-name="Layer 1">
                                    <g>
                                        <path className="cls-1"
                                              d="M22.86,0h23.34l27.79,65.27h-23.64s-1.93-32.64,9.74-32.64c-11.67,0-37.24-32.64-37.24-32.64Z"/>
                                        <path className="cls-1"
                                              d="M7.16,41.28L0,65.27h17.38s4.9-20.92-10.21-23.99Z"/>
                                        <g>
                                            <path className="cls-1"
                                                  d="M59.41,32.61c.43.02.68.02.68.02,0,0-.25-.01-.68-.02Z"/>
                                            <path className="cls-1"
                                                  d="M59.41,32.61c-3.64-.14-21.07-.95-25.01-3.87-3.81-2.63-5.32-7.05-5.32-11.73h0c0,8.63-7,15.63-15.63,15.63h0c8.63,0,15.63,7,15.63,15.63h0c0-5.06,2.41-9.54,6.14-12.4,5.56-4.03,20.79-3.36,24.2-3.25Z"/>
                                        </g>
                                    </g>
                                </g>
                            </svg>
                        </div>
                        <div className="sidebar-inner-top-header-right">
                            <svg className="sidebar-inner-top-header-right-toggle" width="18" height="14" viewBox="0 0 18 14" fill="none">
                                <rect x="12.0002" y="2.66675" width="3.33333" height="8" rx="1" fill="#D9D9D9"/>
                                <rect x="0.5" y="0.5" width="17" height="12.3333" rx="3.5" stroke="white"/>
                            </svg>
                        </div>
                    </div>
                    <div className="sidebar-inner-top-select">
                        <div className="sidebar-inner-top-select-box">
                            <div className="sidebar-inner-top-select-box-inner">
                                <div className="sidebar-inner-top-select-box-inner-left">
                                    <div className="sidebar-inner-top-select-box-inner-left-logo">
                                        <p className="sidebar-inner-top-select-box-inner-left-logo-title">A</p>
                                    </div>
                                    <p className="sidebar-inner-top-select-box-inner-left-title">Awesome Budget</p>
                                </div>
                                <div className="sidebar-inner-top-select-box-inner-right">
                                    <svg className="sidebar-inner-top-select-box-inner-right-icon" width="7" height="12" viewBox="0 0 7 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path opacity="0.4" d="M5.75 8.75L3.25 10.75L0.75 8.75" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path opacity="0.4" d="M0.75 2.75L3.25 0.75L5.75 2.75" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div className="sidebar-inner-top-select-modal" style={{display: 'none'}}>
                            <div className="sidebar-inner-top-select-modal-inner">
                                <div className="sidebar-inner-top-select-modal-inner-top">
                                    <h3 className="sidebar-inner-top-select-modal-inner-top-title">Switch budget</h3>
                                </div>
                                <div className="sidebar-inner-top-select-modal-inner-list">
                                    <div className="sidebar-inner-top-select-modal-inner-list-item">
                                        <div className="sidebar-inner-top-select-modal-inner-list-item-left">
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-dragger">
                                                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <circle cx="1" cy="1" r="1" fill="white" />
                                                    <circle cx="5" cy="1" r="1" fill="white" />
                                                    <circle cx="1" cy="5" r="1" fill="white" />
                                                    <circle cx="5" cy="5" r="1" fill="white" />
                                                    <circle cx="1" cy="9" r="1" fill="white" />
                                                    <circle cx="5" cy="9" r="1" fill="white" />
                                                </svg>
                                            </div>
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-icon">
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-left-icon-title">A</p>
                                            </div>
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-data">
                                                <h3 className="sidebar-inner-top-select-modal-inner-list-item-left-data-title">Awesome Budget</h3>
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-left-data-subtitle">2 Members</p>
                                            </div>
                                        </div>
                                        <div className="sidebar-inner-top-select-modal-inner-list-item-right">
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-right-action">
                                                <div className="sidebar-inner-top-select-modal-inner-list-item-right-action-active">
                                                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                                        <path d="M0.75 2.75L3.25 5.25L7.25 0.75" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sidebar-inner-top-select-modal-inner-list-item">
                                        <div className="sidebar-inner-top-select-modal-inner-list-item-left">
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-dragger">
                                                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <circle cx="1" cy="1" r="1" fill="white" />
                                                    <circle cx="5" cy="1" r="1" fill="white" />
                                                    <circle cx="1" cy="5" r="1" fill="white" />
                                                    <circle cx="5" cy="5" r="1" fill="white" />
                                                    <circle cx="1" cy="9" r="1" fill="white" />
                                                    <circle cx="5" cy="9" r="1" fill="white" />
                                                </svg>
                                            </div>
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-icon">
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-left-icon-title">B</p>
                                            </div>
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-data">
                                                <h3 className="sidebar-inner-top-select-modal-inner-list-item-left-data-title">Budget #2</h3>
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-left-data-subtitle">2 Members</p>
                                            </div>
                                        </div>
                                        <div className="sidebar-inner-top-select-modal-inner-list-item-right">
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-right-action">
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-right-action-label">
                                                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                                        <path d="M7.35714 6.21429C7.58318 6.21429 7.80414 6.28132 7.99208 6.40689C8.18002 6.53247 8.32651 6.71096 8.41301 6.91979C8.49951 7.12862 8.52214 7.35841 8.47804 7.58011C8.43394 7.8018 8.3251 8.00544 8.16527 8.16527C8.00543 8.3251 7.8018 8.43395 7.5801 8.47804C7.35841 8.52214 7.12862 8.49951 6.91979 8.41301C6.71096 8.32651 6.53247 8.18002 6.40689 7.99208C6.28131 7.80414 6.21429 7.58318 6.21429 7.35715V1.64286C6.21429 1.41682 6.28131 1.19586 6.40689 1.00792C6.53247 0.819978 6.71096 0.673496 6.91979 0.586995C7.12862 0.500495 7.35841 0.477863 7.5801 0.52196C7.8018 0.566058 8.00543 0.674904 8.16527 0.834736C8.3251 0.994567 8.43394 1.1982 8.47804 1.4199C8.52214 1.64159 8.49951 1.87138 8.41301 2.08021C8.32651 2.28904 8.18002 2.46753 7.99208 2.59311C7.80414 2.71869 7.58318 2.78572 7.35714 2.78572H6.21429V6.21429H7.35714Z" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                                        <path d="M2.78571 2.78572H1.64286C1.41682 2.78572 1.19586 2.71869 1.00792 2.59311C0.819978 2.46753 0.673495 2.28904 0.586995 2.08021C0.500495 1.87138 0.477863 1.64159 0.52196 1.4199C0.566058 1.1982 0.674904 0.994567 0.834736 0.834736C0.994567 0.674904 1.1982 0.566058 1.4199 0.52196C1.64159 0.477863 1.87138 0.500495 2.08021 0.586995C2.28904 0.673496 2.46753 0.819978 2.59311 1.00792C2.71869 1.19586 2.78571 1.41682 2.78571 1.64286V2.78572ZM2.78571 2.78572H6.21429M2.78571 2.78572V6.21429M2.78571 6.21429V7.35715C2.78571 7.58318 2.71869 7.80414 2.59311 7.99208C2.46753 8.18002 2.28904 8.32651 2.08021 8.41301C1.87138 8.49951 1.64159 8.52214 1.4199 8.47804C1.1982 8.43395 0.994567 8.3251 0.834736 8.16527C0.674904 8.00544 0.566058 7.8018 0.52196 7.58011C0.477863 7.35841 0.500495 7.12862 0.586995 6.91979C0.673495 6.71096 0.819978 6.53247 1.00792 6.40689C1.19586 6.28132 1.41682 6.21429 1.64286 6.21429H2.78571ZM2.78571 6.21429H6.21429" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                                    </svg>
                                                    <span>2</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sidebar-inner-top-select-modal-inner-list-item">
                                        <div className="sidebar-inner-top-select-modal-inner-list-item-left">
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-dragger">
                                                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <circle cx="1" cy="1" r="1" fill="white" />
                                                    <circle cx="5" cy="1" r="1" fill="white" />
                                                    <circle cx="1" cy="5" r="1" fill="white" />
                                                    <circle cx="5" cy="5" r="1" fill="white" />
                                                    <circle cx="1" cy="9" r="1" fill="white" />
                                                    <circle cx="5" cy="9" r="1" fill="white" />
                                                </svg>
                                            </div>
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-icon">
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-left-icon-title">M</p>
                                            </div>
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-left-data">
                                                <h3 className="sidebar-inner-top-select-modal-inner-list-item-left-data-title">My Budget</h3>
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-left-data-subtitle">1 Member</p>
                                            </div>
                                        </div>
                                        <div className="sidebar-inner-top-select-modal-inner-list-item-right">
                                            <div className="sidebar-inner-top-select-modal-inner-list-item-right-action">
                                                <p className="sidebar-inner-top-select-modal-inner-list-item-right-action-label">
                                                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                                        <path d="M7.35714 6.21429C7.58318 6.21429 7.80414 6.28132 7.99208 6.40689C8.18002 6.53247 8.32651 6.71096 8.41301 6.91979C8.49951 7.12862 8.52214 7.35841 8.47804 7.58011C8.43394 7.8018 8.3251 8.00544 8.16527 8.16527C8.00543 8.3251 7.8018 8.43395 7.5801 8.47804C7.35841 8.52214 7.12862 8.49951 6.91979 8.41301C6.71096 8.32651 6.53247 8.18002 6.40689 7.99208C6.28131 7.80414 6.21429 7.58318 6.21429 7.35715V1.64286C6.21429 1.41682 6.28131 1.19586 6.40689 1.00792C6.53247 0.819978 6.71096 0.673496 6.91979 0.586995C7.12862 0.500495 7.35841 0.477863 7.5801 0.52196C7.8018 0.566058 8.00543 0.674904 8.16527 0.834736C8.3251 0.994567 8.43394 1.1982 8.47804 1.4199C8.52214 1.64159 8.49951 1.87138 8.41301 2.08021C8.32651 2.28904 8.18002 2.46753 7.99208 2.59311C7.80414 2.71869 7.58318 2.78572 7.35714 2.78572H6.21429V6.21429H7.35714Z" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                                        <path d="M2.78571 2.78572H1.64286C1.41682 2.78572 1.19586 2.71869 1.00792 2.59311C0.819978 2.46753 0.673495 2.28904 0.586995 2.08021C0.500495 1.87138 0.477863 1.64159 0.52196 1.4199C0.566058 1.1982 0.674904 0.994567 0.834736 0.834736C0.994567 0.674904 1.1982 0.566058 1.4199 0.52196C1.64159 0.477863 1.87138 0.500495 2.08021 0.586995C2.28904 0.673496 2.46753 0.819978 2.59311 1.00792C2.71869 1.19586 2.78571 1.41682 2.78571 1.64286V2.78572ZM2.78571 2.78572H6.21429M2.78571 2.78572V6.21429M2.78571 6.21429V7.35715C2.78571 7.58318 2.71869 7.80414 2.59311 7.99208C2.46753 8.18002 2.28904 8.32651 2.08021 8.41301C1.87138 8.49951 1.64159 8.52214 1.4199 8.47804C1.1982 8.43395 0.994567 8.3251 0.834736 8.16527C0.674904 8.00544 0.566058 7.8018 0.52196 7.58011C0.477863 7.35841 0.500495 7.12862 0.586995 6.91979C0.673495 6.71096 0.819978 6.53247 1.00792 6.40689C1.19586 6.28132 1.41682 6.21429 1.64286 6.21429H2.78571ZM2.78571 6.21429H6.21429" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                                    </svg>
                                                    <span>3</span>
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="sidebar-inner-top-select-modal-inner-bottom">
                                    <div className="sidebar-inner-top-select-modal-inner-bottom-left">
                                        <p className="sidebar-inner-top-select-modal-inner-bottom-left-action">
                                            <svg width="7" height="7" viewBox="0 0 7 7">
                                                <path d="M0.5 3.5H6.5" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                                <path d="M3.5 6.5L3.5 0.5" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            <span>Create new budget</span>
                                        </p>
                                    </div>
                                    <div className="sidebar-inner-top-select-modal-inner-bottom-right">
                                        <p className="sidebar-inner-top-select-modal-inner-bottom-right-label">
                                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                                                <path d="M7.35714 6.21429C7.58318 6.21429 7.80414 6.28132 7.99208 6.40689C8.18002 6.53247 8.32651 6.71096 8.41301 6.91979C8.49951 7.12862 8.52214 7.35841 8.47804 7.58011C8.43394 7.8018 8.3251 8.00544 8.16527 8.16527C8.00543 8.3251 7.8018 8.43395 7.5801 8.47804C7.35841 8.52214 7.12862 8.49951 6.91979 8.41301C6.71096 8.32651 6.53247 8.18002 6.40689 7.99208C6.28131 7.80414 6.21429 7.58318 6.21429 7.35715V1.64286C6.21429 1.41682 6.28131 1.19586 6.40689 1.00792C6.53247 0.819978 6.71096 0.673496 6.91979 0.586995C7.12862 0.500495 7.35841 0.477863 7.5801 0.52196C7.8018 0.566058 8.00543 0.674904 8.16527 0.834736C8.3251 0.994567 8.43394 1.1982 8.47804 1.4199C8.52214 1.64159 8.49951 1.87138 8.41301 2.08021C8.32651 2.28904 8.18002 2.46753 7.99208 2.59311C7.80414 2.71869 7.58318 2.78572 7.35714 2.78572H6.21429V6.21429H7.35714Z" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                                <path d="M2.78571 2.78572H1.64286C1.41682 2.78572 1.19586 2.71869 1.00792 2.59311C0.819978 2.46753 0.673495 2.28904 0.586995 2.08021C0.500495 1.87138 0.477863 1.64159 0.52196 1.4199C0.566058 1.1982 0.674904 0.994567 0.834736 0.834736C0.994567 0.674904 1.1982 0.566058 1.4199 0.52196C1.64159 0.477863 1.87138 0.500495 2.08021 0.586995C2.28904 0.673496 2.46753 0.819978 2.59311 1.00792C2.71869 1.19586 2.78571 1.41682 2.78571 1.64286V2.78572ZM2.78571 2.78572H6.21429M2.78571 2.78572V6.21429M2.78571 6.21429V7.35715C2.78571 7.58318 2.71869 7.80414 2.59311 7.99208C2.46753 8.18002 2.28904 8.32651 2.08021 8.41301C1.87138 8.49951 1.64159 8.52214 1.4199 8.47804C1.1982 8.43395 0.994567 8.3251 0.834736 8.16527C0.674904 8.00544 0.566058 7.8018 0.52196 7.58011C0.477863 7.35841 0.500495 7.12862 0.586995 6.91979C0.673495 6.71096 0.819978 6.53247 1.00792 6.40689C1.19586 6.28132 1.41682 6.21429 1.64286 6.21429H2.78571ZM2.78571 6.21429H6.21429" stroke="#C7C7C7" stroke-linecap="round" stroke-linejoin="round"/>
                                            </svg>
                                            <span>N</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="sidebar-inner-center">
                    <ul className="sidebar-inner-center-list">
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to={budgetHref('')}
                                end
                                className={(s) => linkClass(s)}
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Home 11" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M6.118,6.358A1.883,1.883,0,1,1,8,8.268,1.9,1.9,0,0,1,6.118,6.358Z" transform="translate(4 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M0,4.447l4.743-3.4a5.579,5.579,0,0,1,6.513,0L16,4.447M1.882,6.358v3.821A3.793,3.793,0,0,0,5.647,14h4.706a3.793,3.793,0,0,0,3.765-3.821V6.358" transform="translate(4 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Dashboard</span>
                            </NavLink>
                        </li>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to={budgetHref('/new')}
                                end
                                onClick={maybeBlock}
                                className={(s) => linkClass(s, needsBudget ? 'is-disabled' : '')}
                                aria-disabled={needsBudget}
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Add" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M0,5H5M5,5h5M5,5s0,0,0,5M5,5V0" transform="translate(7 7)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Add new</span>
                            </NavLink>
                        </li>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to="/analytics"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "sidebar-inner-center-list-item-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/poll" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M9.692,0H4.308A4.321,4.321,0,0,0,0,4.333V8.667A4.321,4.321,0,0,0,4.308,13H9.692A4.321,4.321,0,0,0,14,8.667V4.333A4.321,4.321,0,0,0,9.692,0Z" transform="translate(5.5 5.5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M3.5,9.5v-4M7,9.5v-6m3.5,6v-4" transform="translate(5.5 5.5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Analytics</span>
                            </NavLink>
                        </li>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to={budgetHref('/purchases')}
                                end
                                onClick={maybeBlock}
                                className={(s) => linkClass(s, needsBudget ? 'is-disabled' : '')}
                                aria-disabled={needsBudget}
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Wallet" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M13.927,8h-1.89a1.548,1.548,0,0,0,0,3.1h1.946M13.927,8A5.453,5.453,0,0,1,14,8.889v1.778q0,.216-.017.429M13.927,8a5.311,5.311,0,0,0-3.761-4.248M13.983,11.1A5.285,5.285,0,0,1,8.75,16H5.25A5.292,5.292,0,0,1,0,10.667V8.889A5.4,5.4,0,0,1,.33,7.025m9.837-3.273a5.178,5.178,0,0,0-1.417-.2H5.25A5.256,5.256,0,0,0,.33,7.025m9.837-3.273-.82-1.484A4.237,4.237,0,0,0,3.422.608L2.17,1.364A4.639,4.639,0,0,0,.33,7.025" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Purchases</span>
                            </NavLink>
                        </li>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to="/reports"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "sidebar-inner-center-list-item-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Notes-lines-alt" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M4.308,0,9.829,0Q9.915,0,10,.011a4.3,4.3,0,0,1,4,4.275v6.429A4.3,4.3,0,0,1,9.692,15H4.308A4.3,4.3,0,0,1,0,10.714V4.286A4.3,4.3,0,0,1,4.308,0Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M14,4.286H10V.011M9,8H3M6,5H3m7,6H3" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Reports</span>
                            </NavLink>
                        </li>
                    </ul>
                    <ul className="sidebar-inner-center-list">
                        <div className="sidebar-inner-center-list-heading">
                            <svg className="sidebar-inner-center-list-heading-icon" data-name="Xnix/Line/Down Arrow 5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                <path id="vector" d="M0,0,5,5l5-5" transform="translate(7 10)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                            </svg>
                            <span className="sidebar-inner-center-list-heading-title">Budget settings</span>
                        </div>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to={budgetHref('/edit')}
                                end
                                onClick={maybeBlock}
                                className={(s) => linkClass(s, needsBudget ? 'is-disabled' : '')}
                                aria-disabled={needsBudget}
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Notepad edit" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="file-edit" d="M4.308,0,9.829,0Q9.915,0,10,.011a4.3,4.3,0,0,1,4,4.275v6.429A4.3,4.3,0,0,1,9.692,15H4.308A4.3,4.3,0,0,1,0,10.714V4.286A4.3,4.3,0,0,1,4.308,0Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="file-edit-2" data-name="file-edit" d="M4.714,3.129l-1.491,1.2a.722.722,0,0,0,.006,1.051l.963,1.159L8.218,11.38a.491.491,0,0,0,.257.157l2,.457A.5.5,0,0,0,11,11.552l-.093-1.946a.448.448,0,0,0-.114-.269L6.86,4.607,5.8,3.334A.822.822,0,0,0,4.714,3.129Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="file-edit-3" data-name="file-edit" d="M14,4.326H10V.011m-3.14,4.6A2.355,2.355,0,0,1,4.192,6.536" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Edit Budget</span>
                            </NavLink>
                        </li>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to={budgetHref('/members')}
                                end
                                onClick={maybeBlock}
                                className={(s) => linkClass(s, needsBudget ? 'is-disabled' : '')}
                                aria-disabled={needsBudget}
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Users 3" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M7,2.333A2.333,2.333,0,1,1,4.667,0,2.333,2.333,0,0,1,7,2.333Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M9.333,10.733c0,1.8-2.089,3.267-4.667,3.267S0,12.537,0,10.733,2.089,7.467,4.667,7.467,9.333,8.929,9.333,10.733Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-3" data-name="Vector" d="M11.939,4.511a1.4,1.4,0,1,1-1.4-1.4A1.4,1.4,0,0,1,11.939,4.511Z" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-4" data-name="Vector" d="M11.2,13.067A2.6,2.6,0,0,0,14,10.733,2.6,2.6,0,0,0,11.2,8.4" transform="translate(5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Budget Members</span>
                            </NavLink>
                        </li>
                        <li className="sidebar-inner-center-list-item">
                            <NavLink
                                to="/settings"
                                end
                                className={({isActive, isPending, isTransitioning}) =>
                                    [
                                        "sidebar-inner-center-list-item-link",
                                        isPending ? "pending" : "",
                                        isActive ? "active" : "",
                                        isTransitioning ? "transitioning" : "",
                                    ].join(" ")
                                }
                            >
                                <svg className="sidebar-inner-center-list-item-link-icon" data-name="Xnix/Line/Setting Gear" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                                    <path id="Vector" d="M9.5,7a2,2,0,1,1-2-2A2,2,0,0,1,9.5,7Z" transform="translate(4.5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                    <path id="Vector-2" data-name="Vector" d="M2.766,13.1.251,7.813a1.583,1.583,0,0,1,0-1.717L2.75.892A2.022,2.022,0,0,1,4.461,0L7.5,0l3.039,0A2.022,2.022,0,0,1,12.25.892l2.494,5.2a1.583,1.583,0,0,1,0,1.717L12.234,13.1a2.021,2.021,0,0,1-1.72.9H4.485A2.021,2.021,0,0,1,2.766,13.1Z" transform="translate(4.5 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                </svg>
                                <span className="sidebar-inner-center-list-item-link-title">Budget Settings</span>
                            </NavLink>
                        </li>
                    </ul>
                </div>
                <div className="sidebar-inner-bottom">
                    <div className="sidebar-inner-bottom-user">
                        <div className="sidebar-inner-bottom-user-left">
                            <div className="sidebar-inner-bottom-user-left-picture" onClick={handleLogout}>
                                <img src="https://i.pinimg.com/1200x/68/07/12/68071293acaf3e1d6e0488b6342c2ef0.jpg" alt="" />
                            </div>
                        </div>
                        <div className="sidebar-inner-bottom-user-right">

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
