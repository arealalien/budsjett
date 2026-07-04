import React from 'react';
import { NavLink, useLocation, useMatches, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from 'framer-motion';
import Button from "./Button";
import WordsPullUp from "./utils/WordsPullUp";

function useCurrentBudgetSlug() {
    const matches = useMatches();
    const match = matches.find(m => m.handle && m.handle.isBudgetRoute);
    return match?.params?.slug || null;
}

function TopbarPurchaseSearch({ user, onboarding }) {
    const slug = useCurrentBudgetSlug();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [draft, setDraft] = React.useState('');
    const isAvailable = !!user && !onboarding && !!slug;
    const purchasesPath = slug ? `/${slug}/purchases` : '';
    const isPurchasesPage = isAvailable && location.pathname === purchasesPath;
    const activePurchasesQuery = isPurchasesPage ? searchParams.get('q') || '' : null;

    React.useEffect(() => {
        if (activePurchasesQuery !== null) {
            setDraft(activePurchasesQuery);
        }
    }, [activePurchasesQuery]);

    function handleSubmit(event) {
        event.preventDefault();
        if (!isAvailable) return;

        const query = draft.trim();
        const nextParams = isPurchasesPage ? new URLSearchParams(searchParams) : new URLSearchParams();

        if (query) {
            nextParams.set('q', query);
        } else {
            nextParams.delete('q');
        }

        navigate({
            pathname: purchasesPath,
            search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        });
    }

    function clearSearch() {
        setDraft('');

        if (!isPurchasesPage || !searchParams.get('q')) return;

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('q');

        navigate({
            pathname: purchasesPath,
            search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        }, { replace: true });
    }

    if (!isAvailable) return null;

    return (
        <form className="topbar-search" role="search" onSubmit={handleSubmit}>
            <span className="material-symbols-rounded topbar-search-icon" aria-hidden="true">search</span>
            <input
                className="topbar-search-input"
                type="search"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Search purchases..."
                aria-label="Search purchases"
            />
            {draft ? (
                <button
                    className="topbar-search-clear"
                    type="button"
                    onClick={clearSearch}
                    aria-label="Clear purchase search"
                >
                    <span className="material-symbols-rounded" aria-hidden="true">close</span>
                </button>
            ) : null}
            <button className="topbar-search-submit" type="submit" aria-label="Search purchases">
                <span className="material-symbols-rounded" aria-hidden="true">arrow_forward</span>
            </button>
        </form>
    );
}

export default function Navbar({ loading, user, onboarding = false, handleLogout }) {

    return (
        <>
            {!loading && !user ? (
                <nav className="navbar">
                    <motion.div
                        className="navbar-inner view-width-home"
                        initial={{ y: '-10em' }}
                        animate={{ y: 0 }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    >
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
                            <NavLink
                                to="/"
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
                                <WordsPullUp text="Product" />
                            </NavLink>
                            <NavLink
                                to="/"
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
                                <WordsPullUp text="Solutions" delay={0.1} />
                            </NavLink>
                            <NavLink
                                to="/"
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
                                <WordsPullUp text="Pricing" delay={0.15} />
                            </NavLink>
                            <NavLink
                                to="/"
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
                                <WordsPullUp text="Development" delay={0.2} />
                            </NavLink>
                        </div>
                        <div className="navbar-inner-right">
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
                                Register
                            </NavLink>
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
                                <Button variant="white" text="Sign in" type="button" />
                            </NavLink>
                        </div>
                    </motion.div>
                </nav>
            ) : (
                <nav className="topbar">
                    <TopbarPurchaseSearch user={user} onboarding={onboarding} />
                </nav>
            )}
        </>
    );
}
