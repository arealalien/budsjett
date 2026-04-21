import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import Button from '../components/Button';
import { useToast } from '../components/utils/ToastContext';
import Avatar from '../components/Avatar';

function canInvite(role) {
    return role === 'OWNER' || role === 'ADMIN';
}

function roleLabel(role) {
    if (role === 'OWNER') return 'Owner';
    if (role === 'ADMIN') return 'Admin';
    return 'Member';
}

function roleClass(role) {
    if (role === 'OWNER') return 'is-owner';
    if (role === 'ADMIN') return 'is-admin';
    return 'is-member';
}

function displayName(user) {
    return user?.displayName || user?.username || '—';
}

function formatJoinDate(value) {
    if (!value) return 'Unknown';
    try {
        return new Date(value).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return 'Unknown';
    }
}

export default function BudgetMembers() {
    const { budget, reloadBudget } = useOutletContext();
    const role = budget?.role || 'MEMBER';

    const memberStats = useMemo(() => {
        const all = [
            { userId: budget?.owner?.id, role: 'OWNER', user: budget?.owner },
            ...((budget?.members || []).map((m) => ({
                userId: m.userId,
                role: m.role,
                user: m.user,
            }))),
        ].filter(Boolean);

        const seen = new Set();
        const deduped = all.filter((m) => {
            if (!m?.userId || seen.has(m.userId)) return false;
            seen.add(m.userId);
            return true;
        });

        return {
            total: deduped.length,
            admins: deduped.filter((m) => m.role === 'ADMIN').length,
            members: deduped.filter((m) => m.role === 'MEMBER').length,
        };
    }, [budget]);

    return (
        <div className="budget-members">
            <div className="budget-members-hero">
                <div className="budget-members-hero-rim" />
                <div className="budget-members-hero-glow" />

                <div className="budget-members-hero-inner">
                    <div className="budget-members-hero-copy">
                        <p className="budget-members-eyebrow">
                            {budget?.name || 'Budget'} · Members
                        </p>

                        <h1 className="budget-members-title">Manage budget members</h1>

                        <p className="budget-members-subtitle">
                            Add people, update roles, and keep track of who can manage this budget.
                        </p>

                        <div className="budget-members-role">
                            <span>Your role</span>
                            <strong className={`budget-members-role-badge ${roleClass(role)}`}>
                                {roleLabel(role)}
                            </strong>
                        </div>
                    </div>

                    <div className="budget-members-stats">
                        <div className="budget-members-stat">
                            <span>Total</span>
                            <strong>{memberStats.total}</strong>
                        </div>

                        <div className="budget-members-stat">
                            <span>Admins</span>
                            <strong>{memberStats.admins}</strong>
                        </div>

                        <div className="budget-members-stat">
                            <span>Members</span>
                            <strong>{memberStats.members}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className="budget-members-grid">
                {canInvite(role) && (
                    <section className="budget-members-card budget-members-card-invite">
                        <div className="budget-members-card-head">
                            <div>
                                <h3>Invite someone</h3>
                                <p>Invite by username or email to add them to this budget.</p>
                            </div>
                        </div>

                        <InviteInline slug={budget.slug} />
                    </section>
                )}

                <section className="budget-members-card budget-members-card-list">
                    <div className="budget-members-card-head">
                        <div>
                            <h3>Current members</h3>
                            <p>Owner, admins, and members of this budget.</p>
                        </div>
                    </div>

                    <MembersSection
                        budget={budget}
                        myRole={role}
                        onChanged={reloadBudget}
                    />
                </section>
            </div>
        </div>
    );
}

function MembersSection({ budget, myRole, onChanged }) {
    const { showToast } = useToast();
    const [busyId, setBusyId] = useState('');

    const members = useMemo(() => {
        const arr = [
            { userId: budget.owner?.id, role: 'OWNER', user: budget.owner, joinedAt: budget.createdAt },
            ...(budget.members || []),
        ];

        const seen = new Set();
        const deduped = arr.filter((m) => {
            if (!m?.userId) return false;
            if (seen.has(m.userId)) return false;
            seen.add(m.userId);
            return true;
        });

        const roleOrder = { OWNER: 0, ADMIN: 1, MEMBER: 2 };

        return deduped.sort((a, b) => {
            const byRole = roleOrder[a.role] - roleOrder[b.role];
            if (byRole !== 0) return byRole;

            const aName = displayName(a.user).toLowerCase();
            const bName = displayName(b.user).toLowerCase();
            return aName.localeCompare(bName);
        });
    }, [budget]);

    async function changeRole(userId, role) {
        try {
            setBusyId(userId);
            await api.patch(`/budgets/${encodeURIComponent(budget.slug)}/members/${userId}`, { role });
            showToast('Role updated', { type: 'success' });
            await onChanged?.();
        } catch (e) {
            showToast(e.response?.data?.error || e.message, { type: 'error' });
        } finally {
            setBusyId('');
        }
    }

    async function removeMember(userId) {
        if (!window.confirm('Remove this member from the budget?')) return;

        try {
            setBusyId(userId);
            await api.delete(`/budgets/${encodeURIComponent(budget.slug)}/members/${userId}`);
            showToast('Member removed', { type: 'success' });
            await onChanged?.();
        } catch (e) {
            showToast(e.response?.data?.error || e.message, { type: 'error' });
        } finally {
            setBusyId('');
        }
    }

    if (!members.length) {
        return (
            <div className="budget-members-empty">
                No members found.
            </div>
        );
    }

    return (
        <div className="budget-members-list">
            {members.map((m) => {
                const isOwner = m.role === 'OWNER';
                const isAdmin = m.role === 'ADMIN';

                const canChangeRole =
                    myRole === 'OWNER' && !isOwner;

                const canRemove =
                    (myRole === 'OWNER' && !isOwner) ||
                    (myRole === 'ADMIN' && !isOwner && !isAdmin);

                const busy = busyId === m.userId;

                return (
                    <div key={m.userId} className="budget-members-list-item">
                        <div className="budget-members-list-item-user">
                            <Avatar
                                user={m.user}
                                alt={displayName(m.user)}
                                size="3.5em"
                                n={3}
                                className={`budget-members-avatar ${roleClass(m.role)}`}
                                version={m.user?.avatarStorageKey || m.user?.avatarUpdatedAt || undefined}
                                fallbackSrc="/images/avatar-placeholder.jpg"
                            />

                            <div className="budget-members-list-item-user-copy">
                                <div className="budget-members-list-item-user-top">
                                    <strong>{displayName(m.user)}</strong>
                                    <span className={`budget-members-pill ${roleClass(m.role)}`}>
                                        {roleLabel(m.role)}
                                    </span>
                                </div>

                                <div className="budget-members-list-item-user-meta">
                                    Joined {formatJoinDate(m.joinedAt)}
                                </div>
                            </div>
                        </div>

                        <div className="budget-members-list-item-actions">
                            <div className="budget-members-list-item-role">
                                <span className="budget-members-field-label">Role</span>

                                {isOwner ? (
                                    <div className="budget-members-static-role">
                                        Owner
                                    </div>
                                ) : canChangeRole ? (
                                    <select
                                        value={m.role}
                                        onChange={(e) => changeRole(m.userId, e.target.value)}
                                        disabled={busy}
                                        className="budget-members-select"
                                    >
                                        <option value="ADMIN">Admin</option>
                                        <option value="MEMBER">Member</option>
                                    </select>
                                ) : (
                                    <div className="budget-members-static-role">
                                        {roleLabel(m.role)}
                                    </div>
                                )}
                            </div>

                            <div className="budget-members-list-item-remove">
                                <span className="budget-members-field-label">Actions</span>

                                {canRemove ? (
                                    <Button variant="primary" text={busy ? 'Working…' : 'Remove'} type="button" onClick={() => removeMember(m.userId)} disabled={busy} />
                                ) : (
                                    <div className="budget-members-no-action">—</div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function InviteInline({ slug }) {
    const [to, setTo] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const { showToast } = useToast();

    const submit = async (e) => {
        e.preventDefault();
        setMsg('');

        if (!to.trim()) return;

        try {
            setBusy(true);

            await api.post(`/invites/budgets/${encodeURIComponent(slug)}/invites`, {
                to: to.trim(),
            });

            setMsg('Invite sent!');
            setTo('');
            showToast('Invite sent', { type: 'success' });
        } catch (err) {
            const message = err.response?.data?.error || err.message;
            setMsg(message);
            showToast(message, { type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="budget-members-invite">
            <div className="budget-members-invite-row">
                <input
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Invite via username or email"
                    className="budget-members-input"
                />
                <Button variant="primary" text={busy ? 'Sending…' : 'Invite'} type="submit" disabled={busy} />
            </div>

            <div className="budget-members-invite-help">
                {msg ? (
                    <span className={`budget-members-message ${msg.toLowerCase().includes('sent') ? 'is-success' : 'is-error'}`}>
                        {msg}
                    </span>
                ) : (
                    <span>They’ll receive an invite if the username or email is valid.</span>
                )}
            </div>
        </form>
    );
}