import React, { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import SquircleImg from "../Squircle";
import SidebarLinkLabel from "./SidebarLinkLabel";
import { useAuth } from "../AuthContext";
import VerificationBadge from "../VerificationBadge";

export default function SidebarFollowingList({
                                                 phase,
                                                 limit = 12,
                                                 className = "",
                                             }) {
    const { user, imageVersion } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState(null);

    useEffect(() => {
        let alive = true;
        async function run() {
            if (!user) return;
            setLoading(true);
            setErr(null);
            try {
                const res = await fetch(`/api/follow/${user.id}/following/list?take=${limit}`, {
                    credentials: "include",
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (alive) setItems(Array.isArray(data.items) ? data.items : []);
            } catch (e) {
                if (alive) setErr(e);
            } finally {
                if (alive) setLoading(false);
            }
        }
        run();
        return () => { alive = false; };
    }, [user, limit]);

    if (!user) return null;

    return (
        <>
            {loading && (
                <li className="sidebar-menu-useritem">
                    <div className="sidebar-menu-useritem-link">
                        <div className="sidebar-menu-useritem-avatar-skeleton" />
                        <SidebarLinkLabel phase={phase}>&nbsp;</SidebarLinkLabel>
                    </div>
                </li>
            )}
            {err && !loading && (
                <></>
            )}
            {!loading && !err && items.map(u => {
                const imgSrc = `http://localhost:4000/public/${u.profileImage ?? 'defaults/default-profile.jpg'}?v=${imageVersion}`;
                return (
                    <li className="sidebar-menu-useritem" key={u.id}>
                        <NavLink
                            to={`/${u.name}`}
                            end
                            className={({ isActive, isPending, isTransitioning }) =>
                                [
                                    "sidebar-menu-useritem-link",
                                    isPending ? "pending" : "",
                                    isActive ? "active" : "",
                                    isTransitioning ? "transitioning" : "",
                                ].join(" ")
                            }
                        >
                            <SquircleImg
                                n={4}
                                src={imgSrc}
                                alt={u.displayName}
                                className="sidebar-menu-useritem-link-avatar"
                            />
                            <SidebarLinkLabel phase={phase}>
                                {u.displayName}
                            </SidebarLinkLabel>
                            <VerificationBadge level={u.verificationLevel} />
                        </NavLink>
                    </li>
                );
            })}
        </>
    );
}
