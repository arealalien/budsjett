import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../AuthContext';
import Button from '../Button';

const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const ENTRY_KINDS = { EXPENSE: 'EXPENSE', INCOME: 'INCOME' };

export default function PurchaseForm() {
    const { slug } = useParams();
    const { budget = { owner: null, members: [], categories: [] } } = useOutletContext?.() ?? {};
    const { user } = useAuth();

    const members = useMemo(() => {
        const ids = new Set(
            [budget?.owner?.id, ...(budget?.members || []).map((m) => m.userId)].filter(Boolean)
        );
        const list = Array.from(ids).map((id) => {
            const m = (budget?.members || []).find((x) => x.userId === id);
            const u = m?.user || (budget?.owner?.id === id ? budget.owner : null);
            return { id, label: u?.displayName || u?.username || id };
        });
        list.sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0));
        return list;
    }, [budget, user]);

    const categories = budget?.categories || [];
    const singleMember = members.length <= 1;
    const exactlyTwo = members.length === 2;

    const [ok, setOk] = useState(false);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const parseMoneyToCents = (raw) => {
        if (raw == null) return 0;
        let s = String(raw).trim();

        if (!s) return 0;

        s = s.replace(/\s|\u00A0/g, "");

        if (s.includes(",") && s.includes(".")) {
            s = s.replace(/\./g, "").replace(",", ".");
        } else if (s.includes(",")) {
            s = s.replace(",", ".");
        }

        s = s.replace(/[^\d.-]/g, "");

        const n = Number(s);
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
    };

    const toCents = (v) => parseMoneyToCents(v);
    const fromCents = (c) => (c / 100);

    const [splitTouched, setSplitTouched] = useState(false);

    const todayISO = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState({
        kind: ENTRY_KINDS.EXPENSE,
        itemName: '',
        categoryId: categories[0]?.id || '',
        amount: '',
        paidAt: todayISO,
        receivedAt: todayISO,
        paidById: user?.id || '',
        receivedById: user?.id || '',
        shared: !singleMember,
        splitPercentForPayer: 50,
        personalOnly: {},
        notes: '',
        makeRecurring: false,
        recurrence: 'MONTHLY',
        interval: 1,
        startAt: todayISO,
        timeZone: tzGuess
    });

    const isExpense = form.kind === ENTRY_KINDS.EXPENSE;
    const isIncome = !isExpense;

    const setPersonalOnly = (userId, value) => {
        setForm((f) => {
            const next = {
                ...f,
                personalOnly: { ...(f.personalOnly || {}), [userId]: value }
            };

            if (exactlyTwo && !splitTouched && userId === f.paidById) {
                const payerPersonalC = toCents(value);
                if (payerPersonalC > 0) {
                    next.splitPercentForPayer = 0;
                }
            }

            return next;
        });
    };

    const shareCalc = useMemo(() => {
        if (!form.shared) return null;

        const amountC = toCents(form.amount);
        const memberIds = members.map(m => m.id);

        if (amountC <= 0) return { sharedBaseC: 0, amountsC: new Map(), percents: new Map() };

        const personalC = memberIds.reduce(
            (acc, id) => acc + toCents(form.personalOnly?.[id]),
            0
        );

        const sharedBaseC = Math.max(0, amountC - personalC);

        const n = memberIds.length;
        const payerId = form.paidById;
        const otherId = memberIds.find(id => id !== payerId) || payerId;

        const sharedPortionC = new Map();

        if (n <= 1) {
            sharedPortionC.set(memberIds[0], sharedBaseC);
        } else if (n === 2) {
            const p1 = (Number(form.splitPercentForPayer) || 0) / 100;
            const payerShareC = Math.round(sharedBaseC * p1);
            const otherShareC = sharedBaseC - payerShareC;
            sharedPortionC.set(payerId, payerShareC);
            sharedPortionC.set(otherId, otherShareC);
        } else {
            const eq = Math.floor(sharedBaseC / n);
            const rem = sharedBaseC - eq * n;
            memberIds.forEach((id, i) => sharedPortionC.set(id, eq + (i === 0 ? rem : 0)));
        }

        const amountsC = new Map();
        memberIds.forEach(id => {
            const pC = toCents(form.personalOnly?.[id]);
            const sC = sharedPortionC.get(id) || 0;
            amountsC.set(id, pC + sC);
        });

        const percents = new Map();
        memberIds.forEach(id => {
            const pct = amountC > 0 ? (amountsC.get(id) / amountC) * 100 : 0;
            percents.set(id, pct);
        });

        return { sharedBaseC, amountsC, percents };
    }, [form.shared, form.amount, form.personalOnly, form.paidById, form.splitPercentForPayer, members]);

    const settlement = useMemo(() => {
        if (!isExpense || !form.shared || !shareCalc) return null;

        const memberIds = members.map(m => m.id);
        if (!memberIds.length) return null;

        const payerId = form.paidById;
        const totalC = toCents(form.amount);

        const respByIdC = new Map();
        memberIds.forEach(id => respByIdC.set(id, shareCalc.amountsC?.get(id) || 0));

        const paidByIdC = new Map();
        memberIds.forEach(id => paidByIdC.set(id, id === payerId ? totalC : 0));

        const netByIdC = new Map();
        memberIds.forEach(id => netByIdC.set(id, (paidByIdC.get(id) || 0) - (respByIdC.get(id) || 0)));

        if (memberIds.length === 2) {
            const otherId = memberIds.find(id => id !== payerId) || payerId;
            const otherOwesC = respByIdC.get(otherId) || 0;

            return {
                mode: "two",
                payer: { id: payerId, label: members.find(m => m.id === payerId)?.label || "Payer", responsibleC: respByIdC.get(payerId) || 0, netC: netByIdC.get(payerId) || 0 },
                other: { id: otherId, label: members.find(m => m.id === otherId)?.label || "Other", responsibleC: otherOwesC, netC: netByIdC.get(otherId) || 0 },
                transfer: { fromId: otherId, toId: payerId, amountC: otherOwesC }
            };
        }

        return {
            mode: "multi",
            rows: memberIds.map(id => ({
                id,
                label: members.find(m => m.id === id)?.label || id,
                responsibleC: respByIdC.get(id) || 0,
                netC: netByIdC.get(id) || 0
            }))
        };
    }, [isExpense, form.shared, form.paidById, form.amount, shareCalc, members]);

    const owes = useMemo(() => {
        if (!isExpense || !form.shared || !exactlyTwo || !shareCalc) return null;

        const memberIds = members.map(m => m.id);
        const payerId = form.paidById;
        const otherId = memberIds.find(id => id !== payerId) || payerId;

        const otherOwesC = shareCalc.amountsC?.get(otherId) || 0;
        const otherLabel = members.find(m => m.id === otherId)?.label || 'Other';

        return { otherLabel, otherOwesC };
    }, [isExpense, form.shared, exactlyTwo, shareCalc, form.paidById, members]);

    useEffect(() => {
        setForm((f) => ({
            ...f,
            categoryId: f.categoryId || categories[0]?.id || '',
            paidById: f.paidById || user?.id || members[0]?.id || '',
            receivedById: f.receivedById || user?.id || members[0]?.id || '',
            shared: singleMember ? false : f.shared
        }));
    }, [categories, members, singleMember, user?.id]);

    useEffect(() => {
        setErr('');
        setOk(false);
        setForm((f) => {
            if (f.kind === ENTRY_KINDS.EXPENSE) {
                return {
                    ...f,
                    categoryId: f.categoryId || categories[0]?.id || '',
                    paidById: f.paidById || user?.id || members[0]?.id || '',
                };
            } else {
                return {
                    ...f,
                    receivedById: f.receivedById || user?.id || members[0]?.id || '',
                };
            }
        });
    }, [form.kind]);

    useEffect(() => {
        setForm((f) => ({
            ...f,
            shared: f.kind === ENTRY_KINDS.EXPENSE && !singleMember,
        }));
    }, [form.kind, singleMember]);



    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const setShared = (v) => setForm((f) => ({ ...f, shared: v }));

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        setOk(false);

        if (!form.itemName.trim()) return setErr('Item name is required');
        const amountC = toCents(form.amount);
        const amountStr = (amountC / 100).toFixed(2);
        if (!Number.isFinite(amountC) || amountC <= 0) return setErr('Amount must be > 0');
        const amountNum = amountC / 100;

        const personalSumC = members.reduce((acc, m) => acc + toCents(form.personalOnly?.[m.id]), 0);
        if (personalSumC > amountC) return setErr('Personal-only items exceed total amount');

        try {
            setLoading(true);

            const recurring =
                form.makeRecurring
                    ? {
                        recurrence: form.recurrence,
                        interval: Number(form.interval) || 1,
                        startAt: new Date(form.startAt).toISOString(),
                        timeZone: form.timeZone || 'UTC'
                    }
                    : undefined;

            if (form.kind === ENTRY_KINDS.INCOME) {
                if (!form.receivedById) return setErr('Choose who received it');
                const payload = {
                    itemName: form.itemName.trim(),
                    amount: amountStr,
                    receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : undefined,
                    receivedById: form.receivedById,
                    notes: form.notes?.trim() || undefined,
                    recurring
                };
                await api.post(`/budgets/${encodeURIComponent(slug)}/income`, payload, { withCredentials: true });
            } else {
                if (!form.categoryId) return setErr('Choose a category');
                if (!form.paidById) return setErr('Choose who paid');

                let sharesOverride;
                const amountC = toCents(form.amount);

                if (form.shared && shareCalc && shareCalc.percents && amountC > 0) {
                        const raw = members.map(m => ({
                        userId: m.id,
                        pct: shareCalc.percents.get(m.id) || 0
                    }));
                        const rounded = raw.map(r => ({ userId: r.userId, percent: Math.max(0, Math.round(r.pct)) }));
                    let sum = rounded.reduce((a, b) => a + b.percent, 0);
                    if (sum !== 100 && rounded.length) {
                         const idx = rounded.reduce((imax, r, i, arr) => r.percent > arr[imax].percent ? i : imax, 0);
                        rounded[idx].percent += (100 - sum);
                        }
                    sharesOverride = rounded;
                    }

                const payload = {
                    itemName: form.itemName.trim(),
                    categoryId: form.categoryId,
                    amount: amountStr,
                    paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
                    paidById: form.paidById,
                    shared: singleMember ? false : form.shared,
                    splitPercentForPayer:
                        (!sharesOverride && exactlyTwo && (singleMember ? undefined : form.shared))
                            ? Number(form.splitPercentForPayer)
                            : undefined,
                    sharesOverride,
                    notes: form.notes?.trim() || undefined,
                    recurring
                };
                await api.post(`/budgets/${encodeURIComponent(slug)}/purchases`, payload, { withCredentials: true });
            }

            setOk(true);
            setForm((f) => ({ ...f, itemName: '', amount: '', notes: '' }));
        } catch (e) {
            setErr(e?.response?.data?.error || e.message);
        } finally {
            setLoading(false);
        }
    };

    const payerSplit = Number(form.splitPercentForPayer) || 0;
    const otherSplit = 100 - payerSplit;

    return (
        <form onSubmit={onSubmit} className="purchase-form">
            <div className="purchase-form-rim" />
            <div className="purchase-form-glow" />
            <div className="purchase-form-inner">
                <div className="purchase-form-inner-header">
                    <h3>{isIncome ? 'Add income' : 'Add a purchase'}</h3>
                    {ok && <span className="purchase-form-inner-header-badge pf-success">Saved</span>}
                    {err && <span className="purchase-form-inner-header-badge pf-error">{err}</span>}
                </div>

                {/* Entry type */}
                <div className="purchase-form-inner-grid">
                    <div className="purchase-form-inner-grid-field pf-col-span-2">
                        <span className="purchase-form-inner-grid-field-label">Entry type</span>
                        <div className="purchase-form-inner-grid-field-seg">
                            <button
                                type="button"
                                className={`purchase-form-inner-grid-field-seg-btn ${isExpense ? 'active' : ''}`}
                                onClick={() => setForm((f) => ({ ...f, kind: ENTRY_KINDS.EXPENSE }))}
                                aria-pressed={isExpense}
                            >
                                Expense
                            </button>
                            <button
                                type="button"
                                className={`purchase-form-inner-grid-field-seg-btn ${isIncome ? 'active' : ''}`}
                                onClick={() => setForm((f) => ({ ...f, kind: ENTRY_KINDS.INCOME }))}
                                aria-pressed={isIncome}
                            >
                                Income
                            </button>
                        </div>
                    </div>
                </div>

                {isIncome ? (
                    <>
                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field pf-col-span-2">
                                <span className="purchase-form-inner-grid-field-label">Received date</span>
                                <input
                                    type="date"
                                    name="receivedAt"
                                    value={form.receivedAt}
                                    onChange={onChange}
                                    required
                                    className="purchase-form-inner-grid-field-input"
                                />
                            </label>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Item name</span>
                                <input
                                    name="itemName"
                                    value={form.itemName}
                                    onChange={onChange}
                                    placeholder="e.g. Salary"
                                    required
                                    className="purchase-form-inner-grid-field-input"
                                />
                            </label>
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Amount</span>
                                <div className="purchase-form-inner-grid-field-input pf-input-with-prefix">
                                    <span className="purchase-form-inner-grid-field-input-prefix">€</span>
                                    <input
                                        name="amount"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.amount}
                                        onChange={onChange}
                                        placeholder="0,00"
                                    />
                                </div>
                            </label>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field pf-col-span-2">
                                <span className="purchase-form-inner-grid-field-label">Notes</span>
                                <input
                                    name="notes"
                                    value={form.notes}
                                    onChange={onChange}
                                    placeholder="Optional"
                                    className="purchase-form-inner-grid-field-input"
                                />
                            </label>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Make this income recurring</span>
                                <div className="purchase-form-inner-grid-field-checkbox">
                                    <input
                                        className="check-purple"
                                        type="checkbox"
                                        name="makeRecurring"
                                        checked={form.makeRecurring}
                                        onChange={onChange}
                                    />
                                    Repeat this entry automatically
                                </div>
                            </label>
                            {form.makeRecurring && (
                                <label className="purchase-form-inner-grid-field">
                                    <span className="purchase-form-inner-grid-field-label">Starts on</span>
                                    <input
                                        type="date"
                                        name="startAt"
                                        value={form.startAt}
                                        onChange={onChange}
                                        className="purchase-form-inner-grid-field-input"
                                    />
                                </label>
                            )}
                        </div>

                        <div className="purchase-form-inner-grid">
                            {form.makeRecurring && (
                                <>
                                    <label className="purchase-form-inner-grid-field">
                                        <span className="purchase-form-inner-grid-field-label">Repeat every</span>
                                        <input
                                            name="interval"
                                            type="number"
                                            min="1"
                                            value={form.interval}
                                            onChange={onChange}
                                            className="purchase-form-inner-grid-field-input"
                                        />
                                    </label>
                                    <label className="purchase-form-inner-grid-field">
                                        <span className="purchase-form-inner-grid-field-label">Repeat type</span>
                                        <select
                                            name="recurrence"
                                            value={form.recurrence}
                                            onChange={onChange}
                                            className="purchase-form-inner-grid-field-input"
                                        >
                                            <option>DAILY</option>
                                            <option>WEEKLY</option>
                                            <option>MONTHLY</option>
                                            <option>YEARLY</option>
                                        </select>
                                    </label>
                                </>
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Paid date</span>
                                <input
                                    type="date"
                                    name="paidAt"
                                    value={form.paidAt}
                                    onChange={onChange}
                                    required
                                    className="purchase-form-inner-grid-field-input"
                                />
                            </label>

                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Category</span>
                                <select
                                    name="categoryId"
                                    value={form.categoryId}
                                    onChange={onChange}
                                    className="purchase-form-inner-grid-field-input"
                                >
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Item name</span>
                                <input
                                    name="itemName"
                                    value={form.itemName}
                                    onChange={onChange}
                                    placeholder="e.g. Groceries"
                                    required
                                    className="purchase-form-inner-grid-field-input"
                                />
                            </label>

                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Paid by</span>
                                <select
                                    name="paidById"
                                    value={form.paidById}
                                    onChange={onChange}
                                    required
                                    className="purchase-form-inner-grid-field-input"
                                >
                                    {members.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Amount</span>
                                <div className="purchase-form-inner-grid-field-input pf-input-with-prefix">
                                    <span className="purchase-form-inner-grid-field-input-prefix">€</span>
                                    <input
                                        name="amount"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.amount}
                                        onChange={onChange}
                                        placeholder="0,00"
                                    />
                                </div>
                            </label>

                            {!singleMember && (
                                <div className="purchase-form-inner-grid-field">
                                    <span className="purchase-form-inner-grid-field-label">Type</span>
                                    <div className="purchase-form-inner-grid-field-seg">
                                        <button
                                            type="button"
                                            className={`purchase-form-inner-grid-field-seg-btn ${!form.shared ? 'active' : ''}`}
                                            onClick={() => setShared(false)}
                                            aria-pressed={!form.shared}
                                        >
                                            Personal
                                        </button>
                                        <button
                                            type="button"
                                            className={`purchase-form-inner-grid-field-seg-btn ${form.shared ? 'active' : ''}`}
                                            onClick={() => setShared(true)}
                                            aria-pressed={form.shared}
                                        >
                                            Shared
                                        </button>
                                    </div>
                                    <small className="purchase-form-inner-grid-field-help">
                                        {form.shared
                                            ? exactlyTwo
                                                ? 'Split between payer and the other member'
                                                : 'Split equally among all members'
                                            : 'Only the payer covers this expense'}
                                    </small>
                                </div>
                            )}
                        </div>

                        {form.shared && exactlyTwo && (
                            <div className="purchase-form-inner-grid">
                                <div className="purchase-form-inner-grid-field pf-col-span-2">
                                    <div className="purchase-form-inner-grid-field-split-row">
                                        <span className="purchase-form-inner-grid-field-split-row-label">Split % (payer)</span>
                                        <span className="purchase-form-inner-grid-field-split-row-chip">
                                          Payer {payerSplit}% • Other {otherSplit}%
                                        </span>
                                    </div>

                                    <input
                                        name="splitPercentForPayer"
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={form.splitPercentForPayer}
                                        onChange={(e) => {
                                            setSplitTouched(true);
                                            onChange(e);
                                        }}
                                        className="purchase-form-inner-grid-field-range"
                                    />

                                    <div className="purchase-form-inner-grid-field-split-pills">
                                        {[0, 25, 50, 75, 100].map((v) => (
                                            <button
                                                type="button"
                                                key={v}
                                                className={`purchase-form-inner-grid-field-split-pills-pill ${
                                                    Number(form.splitPercentForPayer) === v ? 'active' : ''
                                                }`}
                                                onClick={() => {
                                                    setSplitTouched(true);
                                                    setForm((f) => ({ ...f, splitPercentForPayer: v }));
                                                }}
                                            >
                                                {v}/{100 - v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {settlement?.mode === "two" && (
                            <div className="pf-summary">
                                <div className="pf-summary-row">
                                    <span>{settlement.payer.label} is responsible for</span>
                                    <strong>€{fromCents(settlement.payer.responsibleC).toFixed(2)}</strong>
                                </div>
                                <div className="pf-summary-row">
                                    <span>{settlement.other.label} is responsible for</span>
                                    <strong>€{fromCents(settlement.other.responsibleC).toFixed(2)}</strong>
                                </div>
                            </div>
                        )}

                        {form.shared && members.length > 0 && (
                            <>
                            <div className="purchase-form-inner-grid">
                                <div className="purchase-form-inner-grid-field">
                                      <span className="purchase-form-inner-grid-field-label">
                                        Personal-only items (excluded from shared split)
                                      </span>
                                </div>
                            </div>

                            <div className="purchase-form-inner-grid">
                                {members.map((m) => {
                                    const amountC = toCents(form.amount);
                                    const pct =
                                        form.shared && amountC > 0 && shareCalc
                                            ? (shareCalc.percents.get(m.id) ?? 0)
                                            : null;

                                    return (
                                        <label key={m.id} className="purchase-form-inner-grid-field">
                                            <div className="pf-label-row">
                                                <span className="purchase-form-inner-grid-field-label">
                                                    {m.label}
                                                    {pct !== null && (
                                                        <span className="pf-chip">{pct.toFixed(0)}%</span>
                                                    )}
                                                </span>
                                            </div>

                                            <div className="purchase-form-inner-grid-field-input pf-input-with-prefix">
                                                <span className="purchase-form-inner-grid-field-input-prefix">€</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={form.personalOnly?.[m.id] ?? ""}
                                                    onChange={(e) => setPersonalOnly(m.id, e.target.value)}
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            </>
                        )}

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field pf-col-span-2">
                                <span className="purchase-form-inner-grid-field-label">Notes</span>
                                <input
                                    name="notes"
                                    value={form.notes}
                                    onChange={onChange}
                                    placeholder="Optional"
                                    className="purchase-form-inner-grid-field-input"
                                />
                            </label>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <label className="purchase-form-inner-grid-field">
                                <span className="purchase-form-inner-grid-field-label">Make this purchase recurring</span>
                                <div className="purchase-form-inner-grid-field-checkbox">
                                    <input
                                        className="check-purple"
                                        type="checkbox"
                                        name="makeRecurring"
                                        checked={form.makeRecurring}
                                        onChange={onChange}
                                    />
                                    Repeat this entry automatically
                                </div>
                            </label>

                            {form.makeRecurring && (
                                <label className="purchase-form-inner-grid-field">
                                    <span className="purchase-form-inner-grid-field-label">Starts on</span>
                                    <input
                                        type="date"
                                        name="startAt"
                                        value={form.startAt}
                                        onChange={onChange}
                                        className="purchase-form-inner-grid-field-input"
                                    />
                                </label>
                            )}
                        </div>

                        <div className="purchase-form-inner-grid">
                            {form.makeRecurring && (
                                <>
                                    <label className="purchase-form-inner-grid-field">
                                        <span className="purchase-form-inner-grid-field-label">Repeat every</span>
                                        <input
                                            name="interval"
                                            type="number"
                                            min="1"
                                            value={form.interval}
                                            onChange={onChange}
                                            className="purchase-form-inner-grid-field-input"
                                        />
                                    </label>
                                    <label className="purchase-form-inner-grid-field">
                                        <span className="purchase-form-inner-grid-field-label">Repeat type</span>
                                        <select
                                            name="recurrence"
                                            value={form.recurrence}
                                            onChange={onChange}
                                            className="purchase-form-inner-grid-field-input"
                                        >
                                            <option>DAILY</option>
                                            <option>WEEKLY</option>
                                            <option>MONTHLY</option>
                                            <option>YEARLY</option>
                                        </select>
                                    </label>
                                </>
                            )}
                        </div>
                    </>
                )}

                <div className="purchase-form-inner-actions">
                    <Button
                        className="ba-purple"
                        children={loading ? 'Saving…' : isIncome ? 'Add income' : 'Add purchase'}
                        type="submit"
                        disabled={loading}
                    />
                </div>
            </div>
        </form>
    );
}
