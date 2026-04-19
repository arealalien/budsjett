import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/utils/ToastContext';
import Button from '../components/Button';
import ColorPicker from '../components/ColorPicker';

const NICE_RGBS = [
    "239, 68, 68",
    "245, 158, 11",
    "250, 204, 21",
    "34, 197, 94",
    "16, 185, 129",
    "6, 182, 212",
    "59, 130, 246",
    "99, 102, 241",
    "168, 85, 247",
    "236, 72, 153",
    "244, 63, 94",
    "251, 146, 60",
];

function hsvToRgb(h, s, v) {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;

    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }

    const to255 = (x) => Math.min(255, Math.max(0, Math.round(x * 255)));
    return `${to255(r)}, ${to255(g)}, ${to255(b)}`;
}

function randomNiceColor(existing = []) {
    const used = new Set(existing.map((c) => c.color?.trim()));
    const candidates = NICE_RGBS.filter((c) => !used.has(c));

    if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    const h = Math.random();
    const s = 0.6 + Math.random() * 0.35;
    const v = 0.75 + Math.random() * 0.2;
    return hsvToRgb(h, s, v);
}

function fmtCurrency(n) {
    return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Number(n) || 0);
}

export default function BudgetEdit() {
    const { budget, reloadBudget } = useOutletContext();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [budgetName, setBudgetName] = useState(budget?.name || '');
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [openPicker, setOpenPicker] = useState(null);

    useEffect(() => {
        if (!budget) return;

        setBudgetName(budget.name || '');

        const cats = (budget.categories || [])
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((c) => ({
                id: c.id,
                name: c.name,
                color: c.color || "239, 68, 68",
                planMonthly: Number(c.planMonthly ?? 0),
            }));

        setCategories(cats);
    }, [budget]);

    const totalPlanned = useMemo(
        () => categories.reduce((sum, c) => sum + Number(c.planMonthly || 0), 0),
        [categories]
    );

    const namedCategories = useMemo(
        () => categories.filter((c) => c.name.trim().length > 0).length,
        [categories]
    );

    const updateCat = (idx, patch) => {
        setCategories((cs) => cs.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    };

    const addCat = () => {
        setCategories((cs) => [
            ...cs,
            {
                id: undefined,
                name: '',
                color: randomNiceColor(cs),
                planMonthly: 0,
            },
        ]);
        setOpenPicker(null);
    };

    const removeCat = (idx) => {
        if (categories.length <= 1) {
            showToast('A budget needs at least one category.', { type: 'error' });
            return;
        }

        setCategories((cs) => cs.filter((_, i) => i !== idx));

        setOpenPicker((curr) => {
            if (curr === idx) return null;
            if (curr > idx) return curr - 1;
            return curr;
        });
    };

    const submit = async (e) => {
        e.preventDefault();
        if (!budget) return;

        setSaving(true);
        setError('');

        try {
            const clean = categories
                .map((c) => ({
                    ...c,
                    name: c.name.trim(),
                    color: (c.color || '').trim(),
                    planMonthly: Number(c.planMonthly || 0),
                }))
                .filter((c) => c.name.length > 0);

            if (!budgetName.trim()) {
                throw new Error('Please enter a budget name.');
            }

            if (clean.length === 0) {
                throw new Error('Add at least one category.');
            }

            const body = {
                name: budgetName.trim(),
                categories: clean,
            };

            await api.patch(`/budgets/${encodeURIComponent(budget.slug)}`, body);

            showToast('Budget updated', { type: 'success', duration: 2200 });
            await reloadBudget?.();
            navigate(`/${budget.slug}`);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            showToast(msg, { type: 'error', duration: 3200 });
        } finally {
            setSaving(false);
        }
    };

    if (!budget) {
        return <div className="budgetedit"><p>Loading budget…</p></div>;
    }

    return (
        <div className="budgetedit">
            <form className="budgetedit-form" onSubmit={submit}>
                <div className="budgetedit-form-rim" />
                <div className="budgetedit-form-glow" />

                <div className="budgetedit-form-inner">
                    <header className="budgetedit-header">
                        <div className="budgetedit-header-copy">
                            <p className="budgetedit-header-eyebrow">
                                {budget.name} · Setup
                            </p>
                            <h2 className="budgetedit-header-title">Edit budget</h2>
                            <p className="budgetedit-header-subtitle">
                                Update the budget name, category labels, colors, and monthly targets.
                            </p>
                        </div>

                        <div className="budgetedit-header-stats">
                            <div className="budgetedit-header-stat">
                                <span>Categories</span>
                                <strong>{namedCategories}</strong>
                            </div>

                            <div className="budgetedit-header-stat">
                                <span>Planned total</span>
                                <strong>{fmtCurrency(totalPlanned)}</strong>
                            </div>
                        </div>
                    </header>

                    <section className="budgetedit-section">
                        <div className="budgetedit-section-head">
                            <div>
                                <h3>Budget name</h3>
                                <p>Choose a name that makes this budget easy to recognize.</p>
                            </div>
                        </div>

                        <label className="budgetedit-field">
                            <span className="budgetedit-field-label">Name</span>
                            <input
                                className="budgetedit-input"
                                type="text"
                                value={budgetName}
                                onChange={(e) => setBudgetName(e.target.value)}
                                placeholder="e.g. Home budget"
                                required
                            />
                        </label>
                    </section>

                    <section className="budgetedit-section">
                        <div className="budgetedit-section-head">
                            <div>
                                <h3>Categories</h3>
                                <p>Give each category a clear name, target, and color.</p>
                            </div>

                            <Button variant="primary" text="Add category" type="button" onClick={addCat} />
                        </div>

                        <div className="budgetedit-categories">
                            {categories.map((c, i) => {
                                const isPickerOpen = openPicker === i;

                                return (
                                    <article
                                        key={c.id || `new-${i}`}
                                        className="budgetedit-category"
                                        style={{ "--cat-color": c.color || "239, 68, 68" }}
                                    >
                                        <div className="budgetedit-category-top">
                                            <div className="budgetedit-category-preview">
                                                <div className="budgetedit-category-preview-swatch" />
                                                <div className="budgetedit-category-preview-copy">
                                                    <strong>
                                                        {c.name.trim() || `Category ${i + 1}`}
                                                    </strong>
                                                    <span>
                                                        {fmtCurrency(c.planMonthly || 0)} monthly plan
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                className="budgetedit-category-remove"
                                                type="button"
                                                onClick={() => removeCat(i)}
                                                title="Remove category"
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className="budgetedit-category-grid">
                                            <label className="budgetedit-field">
                                                <span className="budgetedit-field-label">Category name</span>
                                                <input
                                                    className="budgetedit-input"
                                                    type="text"
                                                    value={c.name}
                                                    onChange={(e) => updateCat(i, { name: e.target.value })}
                                                    placeholder="Category name"
                                                    required
                                                />
                                            </label>

                                            <label className="budgetedit-field">
                                                <span className="budgetedit-field-label">Monthly plan</span>
                                                <div className="budgetedit-input budgetedit-input-with-prefix">
                                                    <span className="budgetedit-input-prefix">€</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={c.planMonthly}
                                                        onChange={(e) => updateCat(i, { planMonthly: Number(e.target.value) })}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </label>
                                        </div>

                                        <div className="budgetedit-category-color">
                                            <div className="budgetedit-category-color-head">
                                                <div>
                                                    <span className="budgetedit-field-label">Color</span>
                                                    <p className="budgetedit-category-color-help">
                                                        Pick a preset or fine-tune it manually.
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    className={`budgetedit-category-custom ${isPickerOpen ? 'is-active' : ''}`}
                                                    onClick={() => setOpenPicker((curr) => (curr === i ? null : i))}
                                                >
                                                    {isPickerOpen ? 'Hide custom' : 'Custom color'}
                                                </button>
                                            </div>

                                            <div className="budgetedit-category-swatches">
                                                {NICE_RGBS.map((rgb) => {
                                                    const active = (c.color || '').trim() === rgb.trim();

                                                    return (
                                                        <button
                                                            key={rgb}
                                                            type="button"
                                                            className={`budgetedit-category-swatch ${active ? 'is-active' : ''}`}
                                                            style={{ "--swatch": rgb }}
                                                            onClick={() => updateCat(i, { color: rgb })}
                                                            aria-label={`Choose color ${rgb}`}
                                                            title={rgb}
                                                        />
                                                    );
                                                })}
                                            </div>

                                            {isPickerOpen && (
                                                <div className="budgetedit-category-picker">
                                                    <ColorPicker
                                                        value={c.color}
                                                        onChange={(rgb) => updateCat(i, { color: rgb })}
                                                        label="Custom category color"
                                                        commitOnEnd
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    {error && (
                        <div className="budgetedit-error">
                            {error}
                        </div>
                    )}

                    <div className="budgetedit-footer">
                        <Button variant="primary" text={saving ? 'Saving…' : 'Save changes'} type="submit" disabled={saving} />
                        <Button variant="primary" text="Cancel" type="button" onClick={() => navigate(`/${budget.slug}`)} />
                    </div>
                </div>
            </form>
        </div>
    );
}