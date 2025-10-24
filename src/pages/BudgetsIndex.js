import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Button from '../components/Button';
import { useToast } from '../components/utils/ToastContext';

function RoleBadge({ role }) {
    const cls =
        role === 'OWNER'
            ? 'bg-emerald-100 text-emerald-700'
            : role === 'ADMIN'
                ? 'bg-sky-100 text-sky-700'
                : 'bg-slate-100 text-slate-700';
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {role}
    </span>
    );
}

function Count({ n, label }) {
    return (
        <span className="text-slate-600">
      <strong className="text-slate-900">{n}</strong> {label}
    </span>
    );
}

function OwnerLine({ owner }) {
    if (!owner) return null;
    const name = owner.displayName || owner.username || 'Owner';
    return <span className="text-slate-600">Owner: <strong className="text-slate-900">{name}</strong></span>;
}

export default function BudgetsIndex() {
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const navigate = useNavigate();
    const { showToast } = useToast();

    const fetchBudgets = async () => {
        setLoading(true);
        setErr('');
        try {
            const { data } = await api.get('/budgets');
            setBudgets(Array.isArray(data) ? data : []);
        } catch (e) {
            const msg = e.response?.data?.error || e.message || 'Failed to load budgets';
            setErr(msg);
            showToast(msg, { type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBudgets();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main className="max-w-5xl mx-auto px-4 py-8">
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Your budgets</h1>
                    <p className="text-slate-600">Open an existing budget or create a new one.</p>
                </div>
                <Button className="ba-primary" type="button" onClick={() => setCreateOpen(true)}>
                    + New budget
                </Button>
            </header>

            {createOpen && (
                <CreateBudgetDialog
                    onClose={() => setCreateOpen(false)}
                    onCreated={(b) => {
                        // Navigate straight in after creating
                        showToast('Budget created', { type: 'success' });
                        navigate(`/${b.slug}`);
                    }}
                />
            )}

            {loading && <BudgetSkeleton />}

            {!loading && err && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-rose-700">
                    <p className="mb-3">Couldn’t load budgets.</p>
                    <Button className="ba-white" onClick={fetchBudgets}>Try again</Button>
                </div>
            )}

            {!loading && !err && budgets.length === 0 && (
                <EmptyState onCreate={() => setCreateOpen(true)} />
            )}

            {!loading && !err && budgets.length > 0 && (
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {budgets.map((b) => (
                        <li key={b.id} className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                            <Link to={`/${b.slug}`} className="block p-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl">
                                <div className="mb-2 flex items-start justify-between gap-2">
                                    <h2 className="text-lg font-medium text-slate-900 line-clamp-1">{b.name}</h2>
                                    <RoleBadge role={b.role} />
                                </div>
                                <div className="mb-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
                                    <OwnerLine owner={b.owner} />
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                    <Count n={b.counts?.members ?? 1} label="members" />
                                    <span aria-hidden>•</span>
                                    <Count n={b.counts?.categories ?? 0} label="categories" />
                                    <span aria-hidden>•</span>
                                    <Count n={b.counts?.purchases ?? 0} label="purchases" />
                                </div>
                            </Link>
                            <div className="flex items-center justify-between border-t border-slate-100 p-3">
                                <Link to={`/${b.slug}`} className="text-sm font-medium text-indigo-600 hover:underline">Open</Link>
                                <Link to={`/${b.slug}/edit`} className="text-sm text-slate-600 hover:underline">Edit</Link>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}

/* -------------------- Create Budget Modal -------------------- */

function CreateBudgetDialog({ onClose, onCreated }) {
    const [name, setName] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const { showToast } = useToast();

    const canSubmit = useMemo(() => name.trim().length > 0 && !busy, [name, busy]);

    const submit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        setBusy(true);
        setErr('');
        try {
            const { data } = await api.post('/budgets', { name: name.trim() });
            onCreated?.(data);
            onClose?.();
        } catch (e) {
            const msg = e.response?.data?.error || e.message || 'Failed to create budget';
            setErr(msg);
            showToast(msg, { type: 'error' });
        } finally {
            setBusy(false);
        }
    };

    // very light modal styling; replace with your own component if you have one
    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-1 text-lg font-medium">Create a new budget</h3>
                <p className="mb-4 text-sm text-slate-600">Give it a short, memorable name.</p>
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-slate-700">Budget name</label>
                        <input
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                            type="text"
                            autoFocus
                            placeholder="e.g. Family 2025"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    {err && <p className="text-sm text-rose-600">{err}</p>}
                    <div className="flex items-center justify-end gap-2">
                        <Button type="button" className="ba-white" onClick={onClose} disabled={busy}>
                            Cancel
                        </Button>
                        <Button type="submit" className="ba-primary" disabled={!canSubmit}>
                            {busy ? 'Creating…' : 'Create budget'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* -------------------- UI helpers -------------------- */

function BudgetSkeleton() {
    return (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200 mb-3" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 mb-4" />
                    <div className="flex gap-3">
                        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
                    </div>
                </li>
            ))}
        </ul>
    );
}

function EmptyState({ onCreate }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center">
            <h2 className="mb-1 text-lg font-medium">No budgets yet</h2>
            <p className="mb-4 text-slate-600">Create your first budget to get started.</p>
            <Button className="ba-primary" onClick={onCreate}>Create a budget</Button>
        </div>
    );
}
