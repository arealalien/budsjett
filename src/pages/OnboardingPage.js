import React, { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import { useToast } from '../components/ToastContext';
import Button from '../components/Button';
import ColorPicker from '../components/ColorPicker';

const DEFAULTS = [
    { name: 'Groceries',     color: '239, 68, 68',  planMonthly: 0 },
    { name: 'Takeaway',      color: '245, 158, 11', planMonthly: 0 },
    { name: 'Restaurant',    color: '16, 185, 129', planMonthly: 0 },
    { name: 'Household',     color: '6, 182, 212',  planMonthly: 0 },
    { name: 'Subscriptions', color: '168, 85, 247', planMonthly: 0 },
    { name: 'Savings',       color: '100, 116, 139', planMonthly: 0 },
];

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
    const to255 = x => Math.min(255, Math.max(0, Math.round(x * 255)));
    return `${to255(r)}, ${to255(g)}, ${to255(b)}`;
}

function randomNiceColor(existing = []) {
    const used = new Set(existing.map(c => c.color?.trim()));
    const candidates = NICE_RGBS.filter(c => !used.has(c));
    if (candidates.length) {
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    const h = Math.random();
    const s = 0.6 + Math.random() * 0.35;
    const v = 0.75 + Math.random() * 0.2;
    return hsvToRgb(h, s, v);
}

export default function OnboardingPage() {
    const [budgetName, setBudgetName] = useState('My Budget');
    const [categories, setCategories] = useState(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const [openPicker, setOpenPicker] = useState(null);
    const pickerRef = useRef(null);
    const swatchRef = useRef(null);
    const { setUser } = useAuth();
    const { showToast } = useToast();

    const updateCat = (idx, patch) =>
        setCategories(cs => cs.map((c, i) => i === idx ? { ...c, ...patch } : c));

    const addCat = () =>
        setCategories(cs => [
            ...cs,
            { name: '', color: randomNiceColor(cs), planMonthly: 0 }
        ]);

    const removeCat = (idx) =>
        setCategories(cs => cs.filter((_, i) => i !== idx));

    useEffect(() => {
        const handler = (e) => {
            if (openPicker === null) return;
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setOpenPicker(null);
            }
            const t = e.target;
            const clickedInsidePicker = pickerRef.current?.contains(t);
            const clickedOnSwatch     = swatchRef.current?.contains?.(t);
            if (!clickedInsidePicker && !clickedOnSwatch) {
                setOpenPicker(null);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler, { passive: true });
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [openPicker]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') setOpenPicker(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const clean = categories
                .map(c => ({ ...c, name: c.name.trim() }))
                .filter(c => c.name.length > 0);

            if (!budgetName.trim()) throw new Error('Please enter a budget name.');
            if (clean.length === 0) throw new Error('Add at least one category.');

            await api.post('/auth/onboarding', { budgetName: budgetName.trim(), categories: clean });
            const { data } = await api.get('/auth/me');
            setUser(data);
            showToast('Onboarding complete!', { type: 'success', duration: 2200 });
            navigate(`/${data.slug}`);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            showToast(msg, { type: 'error', duration: 3200 });
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="onboarding">
            <form className="onboarding-form" onSubmit={submit}>
                <div className="onboarding-form-rim"></div>
                <div className="onboarding-form-glow"></div>
                <div className="onboarding-form-inner">
                    <header className="onboarding-form-inner-header">
                        <h2 className="onboarding-form-inner-header-title">Set up your monthly budget</h2>
                        <p className="onboarding-form-inner-header-subtitle">Give it a name, add categories, choose colors, and set monthly targets.</p>
                    </header>

                    <fieldset className="onboarding-form-inner-fieldset">
                        <label className="onboarding-form-inner-fieldset-label">Budget name</label>
                        <input
                            className="onboarding-form-inner-fieldset-input"
                            type="text"
                            value={budgetName}
                            onChange={e => setBudgetName(e.target.value)}
                            placeholder="e.g. My Budget"
                            required
                        />
                    </fieldset>

                    <section className="onboarding-form-inner-cats">
                        <div className="onboarding-form-inner-cats-header">
                            <h3 className="onboarding-form-inner-cats-header-title">Categories</h3>
                            <Button className="ba-white" children="Add category" type="button" onClick={addCat} />
                        </div>

                        <div className="onboarding-form-inner-field">
                            {categories.map((c, i) => {
                                const swatchBg = `rgb(${c.color || '0, 0, 0'})`;
                                const isOpen = openPicker === i;
                                return (
                                <div key={i} className="onboarding-form-inner-field-inner">
                                    <button
                                        type="button"
                                        className="onboarding-form-inner-field-inner-color"
                                        style={{ backgroundColor: swatchBg }}
                                        onPointerDown={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            swatchRef.current = e.currentTarget;
                                            setOpenPicker(curr => (curr === i ? null : i));
                                        }}
                                        aria-expanded={isOpen}
                                        aria-label="Choose category color"
                                        title="Choose category color"
                                    >
                                        <svg className="onboarding-form-inner-field-inner-color-icon" xmlns="http://www.w3.org/2000/svg" width="13.5" height="15.608" viewBox="0 0 13.5 15.608">
                                            <path id="vector" d="M6.209,2.5.311,9.859a.711.711,0,0,0-.171.418L0,13.3a.766.766,0,0,0,.787.687l3-.711a.733.733,0,0,0,.385-.244L10.212,5.5m-4-3L7.8.52A1.2,1.2,0,0,1,9.429.2l2.237,1.862A1.153,1.153,0,0,1,11.657,3.7L10.212,5.5m-4-3a3.56,3.56,0,0,0,4,3" transform="translate(0.75 0.854)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                    </button>
                                    <div className="onboarding-form-inner-field-inner-input">
                                        <svg className="onboarding-form-inner-field-inner-input-icon" xmlns="http://www.w3.org/2000/svg" width="13.5" height="19.5" viewBox="0 0 13.5 19.5">
                                            <path id="Vector" d="M.885,3.672,4.529.527a2.315,2.315,0,0,1,2.942,0l3.644,3.145a1.659,1.659,0,0,1,.6,1.253L12,15a3,3,0,0,1-3,3H3a3,3,0,0,1-3-3L.282,4.925A1.659,1.659,0,0,1,.885,3.672Z" transform="translate(0.75 0.75)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            <path id="Vector-2" data-name="Vector" d="M4,11H8M3,14H9M4.5,5.5a1.5,1.5,0,1,1,.439,1.061A1.5,1.5,0,0,1,4.5,5.5Z" transform="translate(0.75 0.75)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                        </svg>
                                        <input
                                            className="onboarding-form-inner-field-inner-input-field"
                                            type="text"
                                            value={c.name}
                                            onChange={e => updateCat(i, { name: e.target.value })}
                                            placeholder="Category name"
                                            required
                                        />
                                    </div>
                                    <div className="onboarding-form-inner-field-inner-input">
                                        <p className="onboarding-form-inner-field-inner-input-text">€</p>
                                        <input
                                            className="onboarding-form-inner-field-inner-input-field"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={c.planMonthly}
                                            onChange={e => updateCat(i, { planMonthly: Number(e.target.value) })}
                                            placeholder="Monthly plan"
                                        />
                                    </div>
                                    <button className="onboarding-form-inner-field-inner-button" type="button" onClick={() => removeCat(i)}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="11.5" height="15.5" viewBox="0 0 11.5 15.5">
                                            <g id="Group_2634" data-name="Group 2634" transform="translate(-6.25 -4.25)">
                                                <path id="Vector" d="M9.167,4H.833A.833.833,0,0,0,0,4.833V11.5A2.5,2.5,0,0,0,2.5,14h5A2.5,2.5,0,0,0,10,11.5V4.833A.833.833,0,0,0,9.167,4Z" transform="translate(7 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                <path id="Vector-2" data-name="Vector" d="M8,2,7.276.553A1,1,0,0,0,6.382,0H3.618a1,1,0,0,0-.894.553L2,2Z" transform="translate(7 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                                <path id="Vector-3" data-name="Vector" d="M3.333,7.333v3.333M6.667,7.333v3.333M8,2h2M2,2H0" transform="translate(7 5)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                                            </g>
                                        </svg>
                                    </button>
                                    {isOpen && (
                                        <div className="colorpicker" ref={pickerRef}>
                                            <ColorPicker
                                                value={c.color}
                                                onChange={(rgb) => updateCat(i, { color: rgb })}
                                                label="Category color"
                                                commitOnEnd
                                            />
                                        </div>
                                    )}
                                </div>
                                );
                            })}
                        </div>
                    </section>

                    {error && <p style={{ color: 'crimson', marginTop: '.75rem' }}>{error}</p>}

                    <div className="onboarding-form-inner-footer">
                        <Button children={saving ? 'Saving…' : 'Finish onboarding'} type="submit" className="ba-primary" disabled={saving} />
                        <Button
                            type="button"
                            className="ba-white"
                            onClick={async () => {
                                try {
                                    setSaving(true);
                                    await api.post('/auth/onboarding/skip');
                                    const { data } = await api.get('/auth/me');
                                    setUser(data);
                                    showToast('You can create or join a budget anytime.', { type: 'success', duration: 2200 });
                                    navigate('/budgets');
                                } catch (err) {
                                    const msg = err.response?.data?.error || err.message;
                                    setError(msg);
                                    showToast(msg, { type: 'error', duration: 3200 });
                                } finally {
                                    setSaving(false);
                                }
                            }}
                        >
                            Skip for now
                        </Button>
                    </div>
                </div>
            </form>
        </main>
    );
}
