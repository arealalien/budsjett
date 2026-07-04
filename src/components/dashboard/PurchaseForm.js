import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { invalidateBudgetData } from '../../lib/queryInvalidation';
import { useAuth } from '../AuthContext';
import { useToast } from '../utils/ToastContext';
import Button from '../Button';
import Dropdown from '../utils/Dropdown';

const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const QUICK_SPLITS = new Set([50, 60, 70, 80, 100]);

const currencyFormatter = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const amountInputFormatter = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatCurrency = (value) =>
    currencyFormatter.format(Number(value) || 0);

const asCssColor = (color) => {
    if (!color) return null;

    const value = String(color).trim();
    if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(value)) return `rgb(${value})`;

    return value;
};

const formatCentsForInput = (cents) => (
    amountInputFormatter.format((Number(cents) || 0) / 100)
);

const amountToCents = (value) => Math.round((Number(value) || 0) * 100);

const parseMoneyToCents = (raw) => {
    if (raw == null) return 0;

    let value = String(raw).trim();
    if (!value) return 0;

    value = value.replace(/\s|\u00A0/g, '');

    if (value.includes(',') && value.includes('.')) {
        value = value.replace(/\./g, '').replace(',', '.');
    } else if (value.includes(',')) {
        value = value.replace(',', '.');
    }

    value = value.replace(/[^\d.-]/g, '');

    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? Math.round(numberValue * 100) : 0;
};

const toCents = (value) => parseMoneyToCents(value);
const fromCents = (cents) => (Number(cents || 0) / 100);

const formatAmountInput = (raw) => {
    const cents = toCents(raw);
    if (!cents && !String(raw || '').trim()) return '';
    return formatCentsForInput(cents);
};

const toDateInputValue = (value, fallback) => {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString().slice(0, 10);
};

export default function PurchaseForm({
    mode = 'create',
    purchase = null,
    purchasesSearch = '',
}) {
    const { slug } = useParams();
    const { budget = { owner: null, members: [], categories: [] } } = useOutletContext?.() ?? {};
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const isEdit = mode === 'edit';

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

    const categories = useMemo(() => budget?.categories || [], [budget?.categories]);
    const categoryOptions = useMemo(() => (
        categories.map((category) => ({
            value: category.id,
            label: category.name,
            searchText: category.name,
            color: asCssColor(category.color),
            variant: 'custom',
        }))
    ), [categories]);
    const payerOptions = useMemo(() => (
        members.map((member) => ({
            value: member.id,
            label: member.label,
            searchText: member.label,
        }))
    ), [members]);
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
        categoryIds: categories[0]?.id ? [categories[0].id] : [],
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

    useEffect(() => {
        setForm((f) => {
            const availableCategoryIds = new Set(categories.map((category) => category.id));
            const currentCategoryIds = Array.isArray(f.categoryIds)
                ? f.categoryIds.filter((categoryId) => availableCategoryIds.has(categoryId))
                : (f.categoryId && availableCategoryIds.has(f.categoryId) ? [f.categoryId] : []);
            const categoryIds = currentCategoryIds.length
                ? currentCategoryIds
                : (categories[0]?.id ? [categories[0].id] : []);

            return {
                ...f,
                categoryIds,
                categoryId: categoryIds[0] || '',
                paidById: f.paidById || user?.id || members[0]?.id || '',
                shared: singleMember ? false : f.shared,
            };
        });
    }, [categories, members, singleMember, user?.id]);

    useEffect(() => {
        if (!form.makeRecurring) {
            setShowRecurringSettings(false);
        }
    }, [form.makeRecurring]);

    useEffect(() => {
        if (!isEdit || !purchase) return;

        const purchaseCategoryIds = Array.isArray(purchase.categories) && purchase.categories.length
            ? purchase.categories.map((category) => category.id).filter(Boolean)
            : [purchase.category?.id].filter(Boolean);
        const selectedCategoryIds = purchaseCategoryIds.length
            ? [...new Set(purchaseCategoryIds)]
            : (categories[0]?.id ? [categories[0].id] : []);
        const paidById = purchase.paidBy?.id || user?.id || members[0]?.id || '';
        const amountCents = amountToCents(purchase.amount);
        const shares = Array.isArray(purchase.shares) ? purchase.shares : [];
        const payerShare = shares.find((share) => share.userId === paidById);
        const nextSplitPercent = Number.isFinite(Number(payerShare?.percent))
            ? Math.max(0, Math.min(100, Number(payerShare.percent)))
            : 50;
        const personalOnly = {};

        if (purchase.shared && members.length > 2 && amountCents > 0 && shares.length) {
            const allocations = shares.map((share) => ({
                userId: share.userId,
                cents: Math.round(amountCents * (Number(share.percent) || 0) / 100),
            }));
            const assigned = allocations.reduce((sum, allocation) => sum + allocation.cents, 0);
            const remainder = amountCents - assigned;
            const preferredAllocation = allocations.find((allocation) => allocation.userId === paidById) || allocations[0];

            if (preferredAllocation) {
                preferredAllocation.cents += remainder;
            }

            allocations.forEach((allocation) => {
                if (allocation.cents > 0) {
                    personalOnly[allocation.userId] = formatCentsForInput(allocation.cents);
                }
            });
        }

        setForm((current) => ({
            ...current,
            itemName: purchase.itemName || '',
            categoryId: selectedCategoryIds[0] || '',
            categoryIds: selectedCategoryIds,
            amount: amountCents > 0 ? formatCentsForInput(amountCents) : '',
            paidAt: toDateInputValue(purchase.paidAt, todayISO),
            paidById,
            shared: singleMember ? false : !!purchase.shared,
            splitPercentForPayer: nextSplitPercent,
            personalOnly,
            notes: purchase.notes || '',
            makeRecurring: false,
            recurrence: 'MONTHLY',
            interval: 1,
            startAt: todayISO,
            timeZone: tzGuess,
        }));
        setSplitMode(QUICK_SPLITS.has(nextSplitPercent) ? 'quick' : 'advanced');
        setShowPrivateBreakdown(purchase.shared && members.length > 2 && Object.keys(personalOnly).length > 0);
        setShowRecurringSettings(false);
        setOk(false);
        setErr('');
    }, [categories, isEdit, members, purchase, singleMember, todayISO, user?.id]);

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

        if (!form.categoryIds?.length) {
            setErr('Choose at least one category');
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
                categoryId: form.categoryIds[0],
                categoryIds: form.categoryIds,
                amount: (amountC / 100).toFixed(2),
                paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
                paidById: form.paidById,
                shared: singleMember ? false : form.shared,
                sharesOverride: form.shared ? sharesOverride : undefined,
                splitPercentForPayer: undefined,
                notes: form.notes?.trim() || undefined,
                recurring,
            };

            if (isEdit && purchase?.id) {
                await api.patch(
                    `/budgets/${encodeURIComponent(slug)}/purchases/${encodeURIComponent(purchase.id)}`,
                    payload,
                    { withCredentials: true }
                );
            } else {
                await api.post(
                    `/budgets/${encodeURIComponent(slug)}/purchases`,
                    payload,
                    { withCredentials: true }
                );
            }
            invalidateBudgetData(queryClient, slug);

            setOk(true);
            setErr('');
            showToast(isEdit ? 'Purchase updated' : 'Purchase added', {
                type: 'success',
                duration: 2200,
            });

            if (isEdit && purchase?.id) {
                navigate(`/${slug}/purchases/${purchase.id}`, {
                    replace: true,
                    state: { purchasesSearch },
                });
            } else {
                setForm((f) => ({
                    ...f,
                    itemName: '',
                    amount: '',
                    notes: '',
                    personalOnly: {},
                }));
                setSplitMode('quick');
                setShowPrivateBreakdown(false);
            }
        } catch (e2) {
            const message = e2?.response?.data?.error || e2.message || 'Failed to save purchase';
            setErr(message);
            showToast(message, { type: 'error', duration: 3500 });
        } finally {
            setLoading(false);
        }
    };

    const payerSplit = Math.max(0, Math.min(100, Number(form.splitPercentForPayer) || 0));
    const otherSplit = 100 - payerSplit;

    return (
        <form
            onSubmit={onSubmit}
            className="purchase-form"
        >
            <div className="purchase-form-inner">
                <div className="purchase-form-inner-header">
                    <div className="purchase-form-inner-header-copy">
                        <h3>{isEdit ? 'Edit purchase' : 'New purchase'}</h3>
                        <p>
                            {isEdit
                                ? 'Update the saved purchase details, payer, categories, and split.'
                                : 'Add the receipt details, choose who paid, and confirm the split before saving.'}
                        </p>
                    </div>

                    <div className="purchase-form-inner-header-status" aria-live="polite">
                        {ok && <span className="purchase-form-inner-header-badge pf-success">Saved</span>}
                        {err && <span className="purchase-form-inner-header-badge pf-error">{err}</span>}
                    </div>
                </div>

                <section className="purchase-form-section">
                    <div className="purchase-form-section-heading">
                        <h4>Basics</h4>
                        <p>These fields decide how the purchase appears in lists and reports.</p>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <label className="purchase-form-inner-grid-field">
                            <span className="purchase-form-inner-grid-field-label">Purchase name</span>
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
                            <span className="purchase-form-inner-grid-field-label">Total amount</span>
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
                            <small className="purchase-form-inner-grid-field-help">
                                The full receipt amount before any split or private amounts.
                            </small>
                        </label>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <label className="purchase-form-inner-grid-field">
                            <span className="purchase-form-inner-grid-field-label">Purchase date</span>
                            <input
                                type="date"
                                name="paidAt"
                                value={form.paidAt}
                                onChange={onChange}
                                required
                                className="purchase-form-inner-grid-field-input"
                            />
                            <small className="purchase-form-inner-grid-field-help">
                                Used for timelines, filters, and monthly totals.
                            </small>
                        </label>

                        <div className="purchase-form-inner-grid-field">
                            <span className="purchase-form-inner-grid-field-label">Categories</span>
                            <Dropdown
                                name="categoryIds"
                                value={form.categoryIds}
                                onValueChange={(categoryIds) => {
                                    setForm((f) => ({
                                        ...f,
                                        categoryIds,
                                        categoryId: categoryIds[0] || '',
                                    }));
                                }}
                                options={categoryOptions}
                                placeholder="Choose categories"
                                variant="gray"
                                className="purchase-form-dropdown purchase-form-category-dropdown"
                                multiple
                                searchable
                                searchPlaceholder="Search categories..."
                                noResultsText="No categories found"
                                disabled={!categoryOptions.length}
                                required
                            />
                            <small className="purchase-form-inner-grid-field-help">
                                Select one or more categories. The first selected category is the main one.
                            </small>
                        </div>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <div className="purchase-form-inner-grid-field pf-col-span-2">
                            <span className="purchase-form-inner-grid-field-label">Paid by</span>
                            <Dropdown
                                name="paidById"
                                value={form.paidById}
                                onValueChange={(paidById) => {
                                    setForm((f) => ({
                                        ...f,
                                        paidById,
                                    }));
                                }}
                                options={payerOptions}
                                placeholder="Choose who paid"
                                variant="gray"
                                className="purchase-form-dropdown purchase-form-payer-dropdown"
                                searchable={payerOptions.length > 5}
                                searchPlaceholder="Search members..."
                                noResultsText="No members found"
                                disabled={!payerOptions.length}
                                required
                            />
                            <small className="purchase-form-inner-grid-field-help">
                                This is the person who actually paid at checkout.
                            </small>
                        </div>
                    </div>
                </section>

                {!singleMember && (
                    <section className="purchase-form-section">
                        <div className="purchase-form-section-heading">
                            <h4>Split settings</h4>
                            <p>Choose who is responsible for the expense. This can be different from who paid.</p>
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
                                        Only payer
                                    </button>

                                    <button
                                        type="button"
                                        className={`purchase-form-inner-grid-field-seg-btn ${form.shared ? 'active' : ''}`}
                                        onClick={() => setShared(true)}
                                        aria-pressed={form.shared}
                                    >
                                        Shared with members
                                    </button>
                                </div>

                                <small className="purchase-form-inner-grid-field-help">
                                    {!form.shared
                                        ? `${payer?.label || 'The payer'} is responsible for the full amount.`
                                        : exactlyTwo
                                            ? `Choose how much belongs to ${payer?.label || 'the payer'} and ${otherMember?.label || 'the other person'}.`
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
                                                Split method
                                            </span>
                                            <span className="purchase-form-inner-grid-field-split-row-chip">
                                                {payer?.label || 'Payer'} {payerSplit}% / {otherMember?.label || 'Other'} {otherSplit}%
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
                                                    Each option is payer share / other person's share.
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
                                                        Payer responsibility
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
                                        {showPrivateBreakdown
                                            ? (isEdit ? 'Hide individual amounts' : 'Hide private amounts')
                                            : (isEdit ? 'Adjust individual amounts' : 'Add private amounts')}
                                    </button>

                                    <small className="purchase-form-inner-grid-field-help">
                                        {isEdit
                                            ? 'These amounts recreate the saved split. Adjust them if responsibility should change.'
                                            : 'Use this when one person has receipt items that only belong to them. The remainder is split.'}
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
                        <h4>Split preview</h4>
                        <p>Shows each person's responsibility and any reimbursement before saving.</p>
                    </div>

                    {!preview ? (
                        <div className="purchase-form-preview is-empty">
                            Enter a total amount to preview the split.
                        </div>
                    ) : preview.mode === 'personal' ? (
                        <div className="purchase-form-preview">
                            <div className="purchase-form-preview-row">
                                <span>Total purchase</span>
                                <strong>{formatCurrency(fromCents(preview.totalC))}</strong>
                            </div>

                            <div className="purchase-form-preview-row">
                                <span>Paid by</span>
                                <strong>{preview.payer.label}</strong>
                            </div>

                            <div className="purchase-form-preview-highlight">
                                This purchase is not shared.
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
                                    <span>{isEdit && showPrivateBreakdown ? 'Individual amounts' : 'Private part'}</span>
                                    <strong>{formatCurrency(fromCents(personalTotals.totalC))}</strong>
                                </div>
                            )}

                            <div className="purchase-form-preview-row">
                                <span>{isEdit && showPrivateBreakdown ? 'Remaining shared part' : 'Shared part'}</span>
                                <strong>{formatCurrency(fromCents(preview.sharedBaseC))}</strong>
                            </div>

                            {preview.rows.map((row) => (
                                <div key={row.id} className="purchase-form-preview-row">
                                    <span>{row.label} is responsible for</span>
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
                                    <span>{isEdit && showPrivateBreakdown ? 'Individual amounts' : 'Private part'}</span>
                                    <strong>{formatCurrency(fromCents(personalTotals.totalC))}</strong>
                                </div>
                            )}

                            <div className="purchase-form-preview-row">
                                <span>{isEdit && showPrivateBreakdown ? 'Remaining shared part' : 'Shared part'}</span>
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
                        <p>
                            {isEdit
                                ? 'Add or update the saved note for this purchase.'
                                : 'Add a note or create future copies of this purchase.'}
                        </p>
                    </div>

                    <div className="purchase-form-inner-grid">
                        <label className="purchase-form-inner-grid-field pf-col-span-2">
                            <span className="purchase-form-inner-grid-field-label">Notes</span>
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={onChange}
                                placeholder="Anything useful to remember about this purchase"
                                className="purchase-form-inner-grid-field-input purchase-form-textarea"
                                rows="3"
                            />
                        </label>
                    </div>

                    {!isEdit && (
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
                                    Make this a recurring purchase
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
                    )}

                    {!isEdit && form.makeRecurring && showRecurringSettings && (
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
                    {isEdit && purchase?.id && (
                        <Button
                            className="purchase-form-cancel"
                            variant="gray"
                            text="Cancel"
                            type="button"
                            effects="none"
                            onClick={() => {
                                navigate(`/${slug}/purchases/${purchase.id}`, {
                                    state: { purchasesSearch },
                                });
                            }}
                        />
                    )}
                    <Button
                        className="purchase-form-submit"
                        variant="primary"
                        text={loading ? 'Saving...' : (isEdit ? 'Save changes' : 'Add purchase')}
                        type="submit"
                        disabled={loading}
                    />
                </div>
            </div>
        </form>
    );
}
