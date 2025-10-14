import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../components/AuthContext';
import Button from "./Button";

export default function PurchaseForm() {
    const { slug } = useParams();
    const { budget } = useOutletContext();           // from BudgetLayout (now includes categories, members)
    const { user } = useAuth();

    const members = useMemo(() => {
        // members array should include the owner; our backend role tells us who’s who
        const ids = new Set([budget.owner?.id, ...budget.members.map(m => m.userId)]);
        // Build a nice list with displayName/username where available
        const enriched = Array.from(ids).map(id => {
            const m = budget.members.find(x => x.userId === id);
            const u = m?.user || (budget.owner?.id === id ? budget.owner : null);
            return { id, label: u?.displayName || u?.username || id };
        });
        // Ensure current user appears first by default
        enriched.sort((a, b) => (a.id === user?.id ? -1 : b.id === user?.id ? 1 : 0));
        return enriched;
    }, [budget, user]);

    const categories = budget.categories || [];

    const singleMember = members.length <= 1;
    const exactlyTwo   = members.length === 2;

    const [ok, setOk] = useState(false);
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        itemName: '',
        categoryId: categories[0]?.id || '',
        amount: '',
        paidAt: new Date().toISOString().slice(0,10),
        paidById: user?.id || '',
        shared: !singleMember,            // hide in UI if singleMember, but keep state sane
        splitPercentForPayer: 50,         // only used when exactlyTwo
        notes: ''
    });

    // keep defaults in sync when budget loads
    useEffect(() => {
        setForm(f => ({
            ...f,
            categoryId: f.categoryId || categories[0]?.id || '',
            paidById: f.paidById || user?.id || members[0]?.id || '',
            shared: singleMember ? false : f.shared,
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categories, members, singleMember, user?.id]);

    const onChange = e => {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const setShared = (v) => {
        setForm(f => ({ ...f, shared: v }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        setOk(false);

        if (!form.itemName.trim()) return setErr('Item name is required');
        if (!form.categoryId) return setErr('Choose a category');
        if (!form.paidById) return setErr('Choose who paid');
        const amountNum = Number(form.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) return setErr('Amount must be > 0');

        try {
            setLoading(true);
            const payload = {
                itemName: form.itemName.trim(),
                categoryId: form.categoryId,
                amount: amountNum,
                paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
                paidById: form.paidById,
                shared: singleMember ? false : form.shared,
                splitPercentForPayer: exactlyTwo && (singleMember ? undefined : form.shared) ? Number(form.splitPercentForPayer) : undefined,
                notes: form.notes?.trim() || undefined,
            };

            await api.post(`/budgets/${encodeURIComponent(slug)}/purchases`, payload);
            setOk(true);
            setForm(f => ({ ...f, itemName: '', amount: '', notes: '' }));
        } catch (e) {
            setErr(e.response?.data?.error || e.message);
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
                    <h3>Add a purchase</h3>
                    {ok && <span className="purchase-form-inner-header-badge pf-success">Saved</span>}
                    {err && <span className="purchase-form-inner-header-badge pf-error">{err}</span>}
                </div>

                {/* row 1 */}
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
                            {categories.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {/* row 2 */}
                <div className="purchase-form-inner-grid">
                    <label className="purchase-form-inner-grid-field">
                        <span className="purchase-form-inner-grid-field-label">Item name</span>
                        <input
                            name="itemName"
                            value={form.itemName}
                            onChange={onChange}
                            placeholder="e.g. Sofa"
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
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                {/* row 3 */}
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
                                {form.shared ? (exactlyTwo ? 'Split between payer and the other member' : 'Split equally among all members') : 'Only the payer covers this expense'}
                            </small>
                        </div>
                    )}

                    {form.shared && exactlyTwo && (
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
                                {[0, 25, 50, 75, 100].map(v => (
                                    <button
                                        type="button"
                                        key={v}
                                        className={`purchase-form-inner-grid-field-split-pills-pill ${Number(form.splitPercentForPayer) === v ? 'active' : ''}`}
                                        onClick={() => setForm(f => ({ ...f, splitPercentForPayer: v }))}
                                    >
                                        {v}/{100 - v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* row 4 */}
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

                <div className="purchase-form-inner-actions">
                    <Button className="ba-purple" children={loading ? 'Saving…' : 'Add purchase'} type="submit" disabled={loading} />
                </div>
            </div>
        </form>
    );
}
