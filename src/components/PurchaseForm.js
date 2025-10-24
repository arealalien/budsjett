import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import Button from './Button';

const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const ENTRY_KINDS = { EXPENSE: 'EXPENSE', INCOME: 'INCOME' };

export default function PurchaseForm() {
    const { slug } = useParams();
    const { budget = { owner: null, members: [], categories: [] } } = useOutletContext?.() ?? {};
    const { user } = useAuth();

    // Build members list (owner + members), unique + labeled nicely
    const members = useMemo(() => {
        const ids = new Set(
            [budget?.owner?.id, ...(budget?.members || []).map((m) => m.userId)].filter(Boolean)
        );
        const list = Array.from(ids).map((id) => {
            const m = (budget?.members || []).find((x) => x.userId === id);
            const u = m?.user || (budget?.owner?.id === id ? budget.owner : null);
            return { id, label: u?.displayName || u?.username || id };
        });
        // Put current user first for convenience
        list.sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0));
        return list;
    }, [budget, user]);

    const categories = budget?.categories || [];
    const singleMember = members.length <= 1;
    const exactlyTwo = members.length === 2;

    const [ok, setOk] = useState(false);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const todayISO = new Date().toISOString().slice(0, 10);

    const [form, setForm] = useState({
        kind: ENTRY_KINDS.EXPENSE, // EXPENSE | INCOME
        itemName: '',
        categoryId: categories[0]?.id || '',
        amount: '',
        // Dates
        paidAt: todayISO, // for EXPENSE
        receivedAt: todayISO, // for INCOME
        // People
        paidById: user?.id || '',
        receivedById: user?.id || '',
        // Sharing (expenses only)
        shared: !singleMember,
        splitPercentForPayer: 50,
        personalOnly: {},
        // Misc
        notes: '',
        // Recurring
        makeRecurring: false,
        recurrence: 'MONTHLY', // DAILY|WEEKLY|MONTHLY|YEARLY
        interval: 1,
        startAt: todayISO,
        timeZone: tzGuess
    });

    const setPersonalOnly = (userId, value) => {
        setForm(f => ({
             ...f,
            personalOnly: { ...(f.personalOnly || {}), [userId]: value }
        }));
    };

    const shareCalc = useMemo(() => {
        if (!form.shared) return null;
        const amount = Number(form.amount) || 0;
        const memberIds = members.map(m => m.id);
        const personal = memberIds.reduce((acc, id) => acc + (Number(form.personalOnly?.[id]) || 0), 0);
        const sharedBase = Math.max(0, amount - personal);

            if (amount <= 0) return { sharedBase: 0, percents: new Map(), amounts: new Map() };

            // shared portion split
                const n = memberIds.length;
        let sharedPortion = new Map();
        if (n <= 1) {
            sharedPortion.set(memberIds[0], sharedBase); // single-member
            } else if (n === 2) {
            // slider applies to sharedBase only; percent for payer is splitPercentForPayer
                const payerId = form.paidById;
            const otherId = memberIds.find(id => id !== payerId) || payerId;
            const p1 = (Number(form.splitPercentForPayer) || 0) / 100;
            sharedPortion.set(payerId, sharedBase * p1);
            sharedPortion.set(otherId, sharedBase * (1 - p1));
            } else {
            // equal split of sharedBase
                const eq = sharedBase / n;
            memberIds.forEach(id => sharedPortion.set(id, eq));
            }

            // total owed per user = personal-only + their shared portion
                const amounts = new Map();
        memberIds.forEach(id => {
            const personalAmt = Number(form.personalOnly?.[id]) || 0;
            const sharedAmt = sharedPortion.get(id) || 0;
            amounts.set(id, personalAmt + sharedAmt);
            });

            // convert to percents over the total amount
                const percents = new Map();
        memberIds.forEach(id => {
            const pct = amount > 0 ? (amounts.get(id) / amount) * 100 : 0;
            percents.set(id, pct);
            });

            return { sharedBase, amounts, percents };
            }, [form.shared, form.amount, form.personalOnly, form.paidById, form.splitPercentForPayer, members]);

    // Keep defaults in sync when budget loads (members/categories/user)
    useEffect(() => {
        setForm((f) => ({
            ...f,
            categoryId: f.categoryId || categories[0]?.id || '',
            paidById: f.paidById || user?.id || members[0]?.id || '',
            receivedById: f.receivedById || user?.id || members[0]?.id || '',
            shared: singleMember ? false : f.shared
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories, members, singleMember, user?.id]);

    // If switching between Expense/Income, clear errors and adjust irrelevant fields
    useEffect(() => {
        setErr('');
        setOk(false);
        setForm((f) => {
            if (f.kind === ENTRY_KINDS.EXPENSE) {
                // ensure category & paidBy have values; keep existing shared
                return {
                    ...f,
                    categoryId: f.categoryId || categories[0]?.id || '',
                    paidById: f.paidById || user?.id || members[0]?.id || '',
                };
            } else {
                // INCOME: no sharing/category; keep receivedBy sane
                return {
                    ...f,
                    receivedById: f.receivedById || user?.id || members[0]?.id || '',
                };
            }
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Common validations
        if (!form.itemName.trim()) return setErr('Item name is required');
        const amountNum = Number(form.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) return setErr('Amount must be > 0');

        if (form.shared) {
            const personalSum = members.reduce((acc, m) => acc + (Number(form.personalOnly?.[m.id]) || 0), 0);
            if (personalSum > amountNum) return setErr('Personal-only items exceed total amount');
        }

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
                // INCOME payload
                if (!form.receivedById) return setErr('Choose who received it');
                const payload = {
                    itemName: form.itemName.trim(),
                    amount: amountNum,
                    receivedAt: form.receivedAt ? new Date(form.receivedAt).toISOString() : undefined,
                    receivedById: form.receivedById,
                    notes: form.notes?.trim() || undefined,
                    recurring // RecurringRule(kind=INCOME)
                };
                await api.post(`/budgets/${encodeURIComponent(slug)}/income`, payload, { withCredentials: true });
            } else {
                // EXPENSE payload
                if (!form.categoryId) return setErr('Choose a category');
                if (!form.paidById) return setErr('Choose who paid');

                let sharesOverride;
                if (form.shared && shareCalc && shareCalc.percents && Number.isFinite(Number(form.amount)) && Number(form.amount) > 0) {
                    // round percents to integers and fix rounding to total 100
                        const raw = members.map(m => ({
                        userId: m.id,
                        pct: shareCalc.percents.get(m.id) || 0
                    }));
                    // round & normalize
                        const rounded = raw.map(r => ({ userId: r.userId, percent: Math.max(0, Math.round(r.pct)) }));
                    let sum = rounded.reduce((a, b) => a + b.percent, 0);
                    if (sum !== 100 && rounded.length) {
                        // adjust the largest to make it exactly 100
                            const idx = rounded.reduce((imax, r, i, arr) => r.percent > arr[imax].percent ? i : imax, 0);
                        rounded[idx].percent += (100 - sum);
                        }
                    sharesOverride = rounded;
                    }


                const payload = {
                    itemName: form.itemName.trim(),
                    categoryId: form.categoryId,
                    amount: amountNum,
                    paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
                    paidById: form.paidById,
                    shared: singleMember ? false : form.shared,
                    splitPercentForPayer:
                        (!sharesOverride && exactlyTwo && (singleMember ? undefined : form.shared))
                            ? Number(form.splitPercentForPayer)
                            : undefined,
                    sharesOverride,
                    notes: form.notes?.trim() || undefined,
                    recurring // RecurringRule(kind=EXPENSE)
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

    // Helpers to conditionally render fields by kind
    const isExpense = form.kind === ENTRY_KINDS.EXPENSE;
    const isIncome = !isExpense;

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
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.amount}
                                        onChange={onChange}
                                        placeholder="0.00"
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
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.amount}
                                        onChange={onChange}
                                        placeholder="0.00"
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
                                        onChange={onChange}
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
                                                onClick={() => setForm((f) => ({ ...f, splitPercentForPayer: v }))}
                                            >
                                                {v}/{100 - v}
                                            </button>
                                        ))}
                                    </div>
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
                                    const pct =
                                        form.shared && Number(form.amount) > 0 && shareCalc
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
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={form.personalOnly?.[m.id] ?? ''}
                                                    onChange={(e) => setPersonalOnly(m.id, e.target.value)}
                                                    placeholder="0.00"
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
