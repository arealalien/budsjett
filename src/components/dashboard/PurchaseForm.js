import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../AuthContext';
import Button from '../Button';

const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const formatCurrency = (value) =>
    new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);

export default function PurchaseForm() {
    const { slug } = useParams();
    const { budget = { owner: null, members: [], categories: [] } } = useOutletContext?.() ?? {};
    const { user } = useAuth();

    const members = useMemo(() => {
        const ids = new Set(
            [budget?.owner?.id, ...(budget?.members || []).map((m) => m.userId)].filter(Boolean)
        );

        const list = Array.from(ids).map((id) => {
            const membership = (budget?.members || []).find((x) => x.userId === id);
            const memberUser = membership?.user || (budget?.owner?.id === id ? budget.owner : null);

            return {
                id,
                label: memberUser?.displayName || memberUser?.username || id,
            };
        });

        list.sort((a, b) => {
            if (a.id === user?.id) return -1;
            if (b.id === user?.id) return 1;
            return a.label.localeCompare(b.label);
        });

        return list;
    }, [budget, user]);

    const categories = budget?.categories || [];
    const singleMember = members.length <= 1;
    const exactlyTwo = members.length === 2;
    const todayISO = new Date().toISOString().slice(0, 10);

    const [ok, setOk] = useState(false);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const [splitMode, setSplitMode] = useState('quick');
    const [showPrivateBreakdown, setShowPrivateBreakdown] = useState(false);
    const [showRecurringSettings, setShowRecurringSettings] = useState(false);

    const [form, setForm] = useState({
        itemName: '',
        categoryId: categories[0]?.id || '',
        amount: '',
        paidAt: todayISO,
        paidById: user?.id || '',
        shared: !singleMember,
        splitPercentForPayer: 50,
        personalOnly: {},
        notes: '',
        makeRecurring: false,
        recurrence: 'MONTHLY',
        interval: 1,
        startAt: todayISO,
        timeZone: tzGuess,
    });

    const parseMoneyToCents = (raw) => {
        if (raw == null) return 0;

        let s = String(raw).trim();
        if (!s) return 0;

        s = s.replace(/\s|\u00A0/g, '');

        if (s.includes(',') && s.includes('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else if (s.includes(',')) {
            s = s.replace(',', '.');
        }

        s = s.replace(/[^\d.-]/g, '');

        const n = Number(s);
        return Number.isFinite(n) ? Math.round(n * 100) : 0;
    };

    const toCents = (v) => parseMoneyToCents(v);
    const fromCents = (c) => (Number(c || 0) / 100);

    const formatAmountInput = (raw) => {
        const cents = toCents(raw);
        if (!cents && !String(raw || '').trim()) return '';
        return new Intl.NumberFormat(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(cents / 100);
    };

    useEffect(() => {
        setForm((f) => ({
            ...f,
            categoryId: f.categoryId || categories[0]?.id || '',
            paidById: f.paidById || user?.id || members[0]?.id || '',
            shared: singleMember ? false : f.shared,
        }));
    }, [categories, members, singleMember, user?.id]);

    useEffect(() => {
        if (!form.makeRecurring) {
            setShowRecurringSettings(false);
        }
    }, [form.makeRecurring]);

    useEffect(() => {
        if (!form.shared) {
            setSplitMode('quick');
            setShowPrivateBreakdown(false);
        }
    }, [form.shared]);

    useEffect(() => {
        if (!exactlyTwo) {
            setSplitMode('quick');
        }
    }, [exactlyTwo]);

    useEffect(() => {
        if (ok) {
            const t = window.setTimeout(() => setOk(false), 2500);
            return () => window.clearTimeout(t);
        }
    }, [ok]);

    const onChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({
            ...f,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const setShared = (value) => {
        setForm((f) => ({
            ...f,
            shared: value,
        }));
    };

    const setPersonalOnly = (userId, value) => {
        setForm((f) => ({
            ...f,
            personalOnly: {
                ...(f.personalOnly || {}),
                [userId]: value,
            },
        }));
    };

    const amountC = useMemo(() => toCents(form.amount), [form.amount]);

    const payer = useMemo(
        () => members.find((m) => m.id === form.paidById) || null,
        [members, form.paidById]
    );

    const otherMember = useMemo(
        () => members.find((m) => m.id !== form.paidById) || null,
        [members, form.paidById]
    );

    const personalTotals = useMemo(() => {
        const totalC = members.reduce((acc, m) => acc + toCents(form.personalOnly?.[m.id]), 0);
        return { totalC };
    }, [members, form.personalOnly]);

    const shareCalc = useMemo(() => {
        if (!form.shared) return null;

        const memberIds = members.map((m) => m.id);
        if (!memberIds.length || amountC <= 0) {
            return {
                sharedBaseC: 0,
                amountsC: new Map(),
                percents: new Map(),
            };
        }

        const personalC = memberIds.reduce(
            (acc, id) => acc + toCents(form.personalOnly?.[id]),
            0
        );

        const sharedBaseC = Math.max(0, amountC - personalC);
        const sharedPortionC = new Map();

        if (memberIds.length === 1) {
            sharedPortionC.set(memberIds[0], sharedBaseC);
        } else if (memberIds.length === 2) {
            const payerId = form.paidById;
            const otherId = memberIds.find((id) => id !== payerId) || payerId;
            const payerRatio = Math.max(0, Math.min(100, Number(form.splitPercentForPayer) || 0)) / 100;

            const payerShareC = Math.round(sharedBaseC * payerRatio);
            const otherShareC = sharedBaseC - payerShareC;

            sharedPortionC.set(payerId, payerShareC);
            sharedPortionC.set(otherId, otherShareC);
        } else {
            const equalC = Math.floor(sharedBaseC / memberIds.length);
            const remainderC = sharedBaseC - equalC * memberIds.length;

            memberIds.forEach((id, index) => {
                sharedPortionC.set(id, equalC + (index === 0 ? remainderC : 0));
            });
        }

        const amountsC = new Map();
        const percents = new Map();

        memberIds.forEach((id) => {
            const privateC = toCents(form.personalOnly?.[id]);
            const sharedC = sharedPortionC.get(id) || 0;
            const memberTotalC = privateC + sharedC;

            amountsC.set(id, memberTotalC);
            percents.set(id, amountC > 0 ? (memberTotalC / amountC) * 100 : 0);
        });

        return {
            sharedBaseC,
            amountsC,
            percents,
        };
    }, [form.shared, form.personalOnly, form.paidById, form.splitPercentForPayer, members, amountC]);

    const sharesOverride = useMemo(() => {
        if (!form.shared || !shareCalc || amountC <= 0) return undefined;

        const raw = members.map((m) => ({
            userId: m.id,
            percent: Math.max(0, Math.round(shareCalc.percents.get(m.id) || 0)),
        }));

        const total = raw.reduce((sum, item) => sum + item.percent, 0);

        if (total !== 100 && raw.length) {
            const largestIdx = raw.reduce(
                (bestIdx, item, idx, arr) => item.percent > arr[bestIdx].percent ? idx : bestIdx,
                0
            );

            raw[largestIdx].percent += (100 - total);
        }

        return raw;
    }, [form.shared, shareCalc, members, amountC]);

    const preview = useMemo(() => {
        if (amountC <= 0 || !payer) return null;

        if (!form.shared || singleMember) {
            return {
                mode: 'personal',
                payer,
                totalC: amountC,
            };
        }

        const memberIds = members.map((m) => m.id);
        const responsibilityRows = memberIds.map((id) => {
            const member = members.find((m) => m.id === id);
            const responsibleC = shareCalc?.amountsC?.get(id) || 0;

            return {
                id,
                label: member?.label || id,
                responsibleC,
            };
        });

        if (exactlyTwo) {
            const otherId = memberIds.find((id) => id !== form.paidById) || form.paidById;
            const other = members.find((m) => m.id === otherId);
            const otherOwesC = shareCalc?.amountsC?.get(otherId) || 0;

            return {
                mode: 'two',
                payer,
                other: other || { id: otherId, label: 'Other' },
                totalC: amountC,
                sharedBaseC: shareCalc?.sharedBaseC || 0,
                otherOwesC,
                rows: responsibilityRows,
            };
        }

        return {
            mode: 'multi',
            payer,
            totalC: amountC,
            sharedBaseC: shareCalc?.sharedBaseC || 0,
            rows: responsibilityRows,
        };
    }, [amountC, payer, form.shared, singleMember, exactlyTwo, members, shareCalc, form.paidById]);

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        setOk(false);

        if (!form.itemName.trim()) {
            setErr('Item name is required');
            return;
        }

        if (amountC <= 0) {
            setErr('Amount must be greater than 0');
            return;
        }

        if (!form.categoryId) {
            setErr('Choose a category');
            return;
        }

        if (!form.paidById) {
            setErr('Choose who paid');
            return;
        }

        if (personalTotals.totalC > amountC) {
            setErr('Private amounts cannot be more than the total amount');
            return;
        }

        try {
            setLoading(true);

            const recurring = form.makeRecurring
                ? {
                    recurrence: form.recurrence,
                    interval: Number(form.interval) || 1,
                    startAt: new Date(form.startAt).toISOString(),
                    timeZone: form.timeZone || 'UTC',
                }
                : undefined;

            const payload = {
                itemName: form.itemName.trim(),
                categoryId: form.categoryId,
                amount: (amountC / 100).toFixed(2),
                paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
                paidById: form.paidById,
                shared: singleMember ? false : form.shared,
                sharesOverride: form.shared ? sharesOverride : undefined,
                splitPercentForPayer: undefined,
                notes: form.notes?.trim() || undefined,
                recurring,
            };

            await api.post(
                `/budgets/${encodeURIComponent(slug)}/purchases`,
                payload,
                { withCredentials: true }
            );

            setOk(true);
            setErr('');

            setForm((f) => ({
                ...f,
                itemName: '',
                amount: '',
                notes: '',
                personalOnly: {},
            }));
            setSplitMode('quick');
            setShowPrivateBreakdown(false);
        } catch (e2) {
            setErr(e2?.response?.data?.error || e2.message || 'Failed to save purchase');
        } finally {
            setLoading(false);
        }
    };

    const payerSplit = Math.max(0, Math.min(100, Number(form.splitPercentForPayer) || 0));
    const otherSplit = 100 - payerSplit;

    return (
        <form onSubmit={onSubmit} className="purchase-form">
            <div className="purchase-form-rim" />
            <div className="purchase-form-glow" />

            <div className="purchase-form-inner">
                <div className="purchase-form-inner-header">
                    <div className="purchase-form-inner-header-copy">
                        <h3>Add a purchase</h3>
                        <p>Create a new expense and preview how it will be split before saving.</p>
                    </div>

                    <div className="purchase-form-inner-header-status">
                        {ok && <span className="purchase-form-inner-header-badge pf-success">Saved</span>}
                        {err && <span className="purchase-form-inner-header-badge pf-error">{err}</span>}
                    </div>
                </div>

                <section className="purchase-form-section">
                    <div className="purchase-form-section-heading">
                        <h4>Basics</h4>
                        <p>Start with the purchase details.</p>
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
                            <span className="purchase-form-inner-grid-field-label">Amount</span>
                            <div className="purchase-form-inner-grid-field-input pf-input-with-prefix">
                                <span className="purchase-form-inner-grid-field-input-prefix">€</span>
                                <input
                                    name="amount"
                                    type="text"
                                    inputMode="decimal"
                                    value={form.amount}
                                    onChange={onChange}
                                    onBlur={() => {
                                        setForm((f) => ({
                                            ...f,
                                            amount: f.amount ? formatAmountInput(f.amount) : '',
                                        }));
                                    }}
                                    placeholder="0,00"
                                />
                            </div>
                        </label>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <label className="purchase-form-inner-grid-field">
                            <span className="purchase-form-inner-grid-field-label">Date</span>
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
                        <label className="purchase-form-inner-grid-field pf-col-span-2">
                            <span className="purchase-form-inner-grid-field-label">Who paid?</span>
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
                </section>

                {!singleMember && (
                    <section className="purchase-form-section">
                        <div className="purchase-form-section-heading">
                            <h4>Who should this count for?</h4>
                            <p>Choose whether this expense is only for the payer or shared with others.</p>
                        </div>

                        <div className="purchase-form-inner-grid">
                            <div className="purchase-form-inner-grid-field pf-col-span-2">
                                <div className="purchase-form-inner-grid-field-seg">
                                    <button
                                        type="button"
                                        className={`purchase-form-inner-grid-field-seg-btn ${!form.shared ? 'active' : ''}`}
                                        onClick={() => setShared(false)}
                                        aria-pressed={!form.shared}
                                    >
                                        Just me
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
                                    {!form.shared
                                        ? `${payer?.label || 'The payer'} covers the full amount.`
                                        : exactlyTwo
                                            ? `Split this between ${payer?.label || 'the payer'} and ${otherMember?.label || 'the other person'}.`
                                            : `Split this across all ${members.length} members.`}
                                </small>
                            </div>
                        </div>

                        {form.shared && exactlyTwo && (
                            <>
                                <div className="purchase-form-inner-grid">
                                    <div className="purchase-form-inner-grid-field pf-col-span-2">
                                        <div className="purchase-form-inner-grid-field-split-row">
                                            <span className="purchase-form-inner-grid-field-split-row-label">
                                                Split mode
                                            </span>
                                            <span className="purchase-form-inner-grid-field-split-row-chip">
                                                {payer?.label || 'Payer'} {payerSplit}% • {otherMember?.label || 'Other'} {otherSplit}%
                                            </span>
                                        </div>

                                        <div className="purchase-form-inner-grid-field-seg purchase-form-inner-grid-field-seg--split-mode">
                                            <button
                                                type="button"
                                                className={`purchase-form-inner-grid-field-seg-btn ${splitMode === 'quick' ? 'active' : ''}`}
                                                onClick={() => setSplitMode('quick')}
                                                aria-pressed={splitMode === 'quick'}
                                            >
                                                Quick split
                                            </button>

                                            <button
                                                type="button"
                                                className={`purchase-form-inner-grid-field-seg-btn ${splitMode === 'advanced' ? 'active' : ''}`}
                                                onClick={() => setSplitMode('advanced')}
                                                aria-pressed={splitMode === 'advanced'}
                                            >
                                                Advanced split
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="purchase-form-inner-grid">
                                    <div className="purchase-form-inner-grid-field pf-col-span-2">
                                        {splitMode === 'quick' ? (
                                            <div className="purchase-form-split-panel">
                                                <small className="purchase-form-inner-grid-field-help">
                                                    Pick a common split quickly.
                                                </small>

                                                <div className="purchase-form-inner-grid-field-split-pills">
                                                    {[50, 60, 70, 80, 100].map((v) => (
                                                        <button
                                                            type="button"
                                                            key={v}
                                                            className={`purchase-form-inner-grid-field-split-pills-pill ${payerSplit === v ? 'active' : ''}`}
                                                            onClick={() => {
                                                                setForm((f) => ({
                                                                    ...f,
                                                                    splitPercentForPayer: v,
                                                                }));
                                                            }}
                                                        >
                                                            {v}/{100 - v}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="purchase-form-split-panel">
                                                <div className="purchase-form-inner-grid-field-split-row">
                                                    <span className="purchase-form-inner-grid-field-split-row-label">
                                                        How much should {payer?.label || 'the payer'} cover?
                                                    </span>
                                                    <span className="purchase-form-inner-grid-field-split-row-chip">
                                                        {payerSplit}% / {otherSplit}%
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
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {form.shared && (
                            <div className="purchase-form-inner-grid">
                                <div className="purchase-form-inner-grid-field pf-col-span-2">
                                    <button
                                        type="button"
                                        className={`purchase-form-toggle ${showPrivateBreakdown ? 'active' : ''}`}
                                        onClick={() => setShowPrivateBreakdown((v) => !v)}
                                    >
                                        {showPrivateBreakdown ? 'Hide private part' : 'Add a private part of this purchase'}
                                    </button>

                                    <small className="purchase-form-inner-grid-field-help">
                                        Use this if part of the receipt should belong to one person before the rest is shared.
                                    </small>
                                </div>
                            </div>
                        )}

                        {form.shared && showPrivateBreakdown && (
                            <div className="purchase-form-inner-grid">
                                {members.map((m) => {
                                    const pct = amountC > 0 && shareCalc
                                        ? (shareCalc.percents.get(m.id) ?? 0)
                                        : 0;

                                    return (
                                        <label key={m.id} className="purchase-form-inner-grid-field">
                                            <div className="pf-label-row">
                                                <span className="purchase-form-inner-grid-field-label">
                                                    {m.label}
                                                    {amountC > 0 && <span className="pf-chip">{pct.toFixed(0)}%</span>}
                                                </span>
                                            </div>

                                            <div className="purchase-form-inner-grid-field-input pf-input-with-prefix">
                                                <span className="purchase-form-inner-grid-field-input-prefix">€</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={form.personalOnly?.[m.id] ?? ''}
                                                    onChange={(e) => setPersonalOnly(m.id, e.target.value)}
                                                    onBlur={() => {
                                                        const nextVal = form.personalOnly?.[m.id] ?? '';
                                                        setPersonalOnly(m.id, nextVal ? formatAmountInput(nextVal) : '');
                                                    }}
                                                    placeholder="0,00"
                                                />
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                <section className="purchase-form-section">
                    <div className="purchase-form-section-heading">
                        <h4>Preview</h4>
                        <p>See what this expense means before you save it.</p>
                    </div>

                    {!preview ? (
                        <div className="purchase-form-preview is-empty">
                            Enter an amount to see the breakdown.
                        </div>
                    ) : preview.mode === 'personal' ? (
                        <div className="purchase-form-preview">
                            <div className="purchase-form-preview-row">
                                <span>Total purchase</span>
                                <strong>{formatCurrency(fromCents(preview.totalC))}</strong>
                            </div>

                            <div className="purchase-form-preview-row">
                                <span>Covered by</span>
                                <strong>{preview.payer.label}</strong>
                            </div>

                            <div className="purchase-form-preview-highlight">
                                Only {preview.payer.label} covers this expense.
                            </div>
                        </div>
                    ) : preview.mode === 'two' ? (
                        <div className="purchase-form-preview">
                            <div className="purchase-form-preview-row">
                                <span>Total purchase</span>
                                <strong>{formatCurrency(fromCents(preview.totalC))}</strong>
                            </div>

                            {personalTotals.totalC > 0 && (
                                <div className="purchase-form-preview-row">
                                    <span>Private part</span>
                                    <strong>{formatCurrency(fromCents(personalTotals.totalC))}</strong>
                                </div>
                            )}

                            <div className="purchase-form-preview-row">
                                <span>Shared part</span>
                                <strong>{formatCurrency(fromCents(preview.sharedBaseC))}</strong>
                            </div>

                            {preview.rows.map((row) => (
                                <div key={row.id} className="purchase-form-preview-row">
                                    <span>{row.label} covers</span>
                                    <strong>{formatCurrency(fromCents(row.responsibleC))}</strong>
                                </div>
                            ))}

                            <div className="purchase-form-preview-highlight">
                                {preview.other.label} owes {preview.payer.label} {formatCurrency(fromCents(preview.otherOwesC))}
                            </div>
                        </div>
                    ) : (
                        <div className="purchase-form-preview">
                            <div className="purchase-form-preview-row">
                                <span>Total purchase</span>
                                <strong>{formatCurrency(fromCents(preview.totalC))}</strong>
                            </div>

                            {personalTotals.totalC > 0 && (
                                <div className="purchase-form-preview-row">
                                    <span>Private part</span>
                                    <strong>{formatCurrency(fromCents(personalTotals.totalC))}</strong>
                                </div>
                            )}

                            <div className="purchase-form-preview-row">
                                <span>Shared part</span>
                                <strong>{formatCurrency(fromCents(preview.sharedBaseC))}</strong>
                            </div>

                            <div className="purchase-form-preview-list">
                                {preview.rows.map((row) => (
                                    <div key={row.id} className="purchase-form-preview-list-item">
                                        <span>{row.label}</span>
                                        <strong>{formatCurrency(fromCents(row.responsibleC))}</strong>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <section className="purchase-form-section">
                    <div className="purchase-form-section-heading">
                        <h4>Optional details</h4>
                        <p>Add notes or repeat this purchase automatically.</p>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <label className="purchase-form-inner-grid-field pf-col-span-2">
                            <span className="purchase-form-inner-grid-field-label">Notes</span>
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={onChange}
                                placeholder="Optional notes"
                                className="purchase-form-inner-grid-field-input purchase-form-textarea"
                                rows="3"
                            />
                        </label>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <div className="purchase-form-inner-grid-field pf-col-span-2">
                            <label className="purchase-form-inner-grid-field-checkbox">
                                <input
                                    className="check-purple"
                                    type="checkbox"
                                    name="makeRecurring"
                                    checked={form.makeRecurring}
                                    onChange={onChange}
                                />
                                Repeat this purchase automatically
                            </label>

                            {form.makeRecurring && (
                                <button
                                    type="button"
                                    className={`purchase-form-toggle ${showRecurringSettings ? 'active' : ''}`}
                                    onClick={() => setShowRecurringSettings((v) => !v)}
                                >
                                    {showRecurringSettings ? 'Hide repeat settings' : 'Show repeat settings'}
                                </button>
                            )}
                        </div>
                    </div>

                    {form.makeRecurring && showRecurringSettings && (
                        <div className="purchase-form-inner-grid">
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

                            <label className="purchase-form-inner-grid-field pf-col-span-2">
                                <span className="purchase-form-inner-grid-field-label">Repeat type</span>
                                <select
                                    name="recurrence"
                                    value={form.recurrence}
                                    onChange={onChange}
                                    className="purchase-form-inner-grid-field-input"
                                >
                                    <option value="DAILY">Daily</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="YEARLY">Yearly</option>
                                </select>
                            </label>
                        </div>
                    )}
                </section>

                <div className="purchase-form-inner-actions">
                    <Button variant="primary" text={loading ? 'Saving…' : 'Add purchase'} type="submit" disabled={loading} />
                </div>
            </div>
        </form>
    );
}