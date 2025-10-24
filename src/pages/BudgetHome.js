// BudgetHome.jsx
import React, { useMemo, useState } from 'react';
import {NavLink, useOutletContext} from 'react-router-dom';
import PurchasesTable from "../components/PurchasesTable";
import { api } from '../lib/api';
import Button from '../components/Button';
import { useToast } from '../components/ToastContext';
import SpendingTrend from "../components/SpendingTrend";
import CurrentBalance from "../components/CurrentBalance";
import CategoryTotals from "../components/CategoryTotals";
import IncomeTotals from "../components/IncomeTotals";

function canInvite(role) { return role === 'OWNER' || role === 'ADMIN'; }

const toRgbTriplet = (color) => {
    const m = String(color).match(/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*$/);
    return m ? `${m[1]} ${m[2]} ${m[3]}` : color; // if already CSS color, leave as-is
};


export default function BudgetHome() {
    const { budget, reloadBudget } = useOutletContext();
    const role = budget.role || 'MEMBER';

    // Publish variables like --cat-groceries: "34 197 94"
    const catCssVars = (budget?.categories || []).reduce((vars, c) => {
        if (c?.slug && c?.color) {
            vars[`--cat-${c.slug}`] = toRgbTriplet(c.color);
        }
        return vars;
    }, {});

    return (
        <div className="budget-home" style={{catCssVars, width: '100%'}}>
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span>Role: {role}</span>
                {canInvite(role) && <InviteInline slug={budget.slug} />}
            </div>

            {/* Members */}
            <MembersSection budget={budget} myRole={role} onChanged={reloadBudget} />

            <div style={{ marginTop: 16 }}>
                <PurchasesTable size="compact" />
                <SpendingTrend />
                <CurrentBalance />
                <CategoryTotals />
                <IncomeTotals />
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
        // de-dupe owner if already in members array
        const seen = new Set();
        return arr.filter(m => {
            if (!m?.userId) return false;
            if (seen.has(m.userId)) return false;
            seen.add(m.userId);
            return true;
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

    function displayName(u) {
        return u?.displayName || u?.username || '—';
    }

    return (
        <section style={{ marginTop: 20 }}>
            <h3 className="text-lg font-medium mb-2">Members</h3>
            <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                    <tr>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Role</th>
                        <th className="text-right p-2">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {members.map(m => {
                        const isOwner = m.role === 'OWNER';
                        const isAdmin = m.role === 'ADMIN';
                        const canChangeRole =
                            (myRole === 'OWNER' && !isOwner); // only owner can change roles; not owner row
                        const canRemove =
                            (myRole === 'OWNER' && !isOwner) ||
                            (myRole === 'ADMIN' && !isOwner && !isAdmin); // admin can remove members only
                        return (
                            <tr key={m.userId} className="border-t border-slate-100">
                                <td className="p-2">{displayName(m.user)}</td>
                                <td className="p-2">
                                    {isOwner ? (
                                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">OWNER</span>
                                    ) : canChangeRole ? (
                                        <select
                                            value={m.role}
                                            onChange={e => changeRole(m.userId, e.target.value)}
                                            disabled={busyId === m.userId}
                                            className="rounded border border-slate-300 px-2 py-1 bg-white"
                                        >
                                            <option value="ADMIN">ADMIN</option>
                                            <option value="MEMBER">MEMBER</option>
                                        </select>
                                    ) : (
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${isAdmin ? 'bg-sky-100 text-sky-700':'bg-slate-100 text-slate-700'}`}>
                        {m.role}
                      </span>
                                    )}
                                </td>
                                <td className="p-2 text-right">
                                    {canRemove ? (
                                        <Button className="ba-gray" onClick={() => removeMember(m.userId)} disabled={busyId === m.userId}>
                                            Remove
                                        </Button>
                                    ) : (
                                        <span className="text-slate-400">—</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function InviteInline({ slug }) {
    const [to, setTo] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setMsg('');
        if (!to.trim()) return;
        try {
            setBusy(true);
            await api.post(`/invites/budgets/${encodeURIComponent(slug)}/invites`, { to: to.trim() });
            setMsg('Invite sent!');
            setTo('');
        } catch (err) {
            setMsg(err.response?.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} style={{ display:'inline-flex', gap:8, alignItems:'center' }}>
            <input
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="Invite via username or email"
                style={{ padding: '6px 10px', borderRadius: 8 }}
            />
            <Button className="ba-purple" type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Invite'}
            </Button>
            {msg && <span style={{ fontSize:12, color: msg.includes('!') ? 'green':'crimson' }}>{msg}</span>}
        </form>
    );
}