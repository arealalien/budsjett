import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import Button from "./Button";

const CATEGORIES = [
    'FURNITURE', 'GROCERIES', 'TAKEAWAY', 'RESTAURANT',
    'HOUSEHOLD', 'SUBSCRIPTIONS', 'OTHER'
];

const CATEGORY_LABELS = {
    FURNITURE: 'Furniture',
    GROCERIES: 'Groceries',
    TAKEAWAY: 'Takeaway',
    RESTAURANT: 'Restaurant',
    HOUSEHOLD: 'Household',
    SUBSCRIPTIONS: 'Subscriptions',
    OTHER: 'Other',
};

const labelForCategory = (c) => CATEGORY_LABELS[c] ?? c;

export default function PurchaseForm() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');
    const [ok, setOk] = useState(false);

    const [form, setForm] = useState({
        itemName: '',
        category: 'GROCERIES',
        amount: '',
        paidAt: new Date().toISOString().slice(0, 10),
        paidById: '',
        shared: true,
        splitPercentForPayer: 50,
        notes: ''
    });

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/auth/users', { withCredentials: true });
                setUsers(data);
                if (data?.length && !form.paidById) {
                    setForm(f => ({ ...f, paidById: data[0].id }));
                }
            } catch {}
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onChange = e => {
        const { name, value, type, checked } = e.target;
        setForm(f => ({
            ...f,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const setShared = (isShared) => {
        setForm(f => ({
            ...f,
            shared: isShared,
            // keep last chosen split, but clamp
            splitPercentForPayer: Math.min(100, Math.max(0, Number(f.splitPercentForPayer) || 50))
        }));
    };

    const onSubmit = async e => {
        e.preventDefault();
        setErr('');
        setOk(false);

        if (!form.itemName.trim()) return setErr('Item name is required');
        if (!form.paidById) return setErr('Select who paid');
        const amountNum = Number(form.amount);
        if (!Number.isFinite(amountNum) || amountNum <= 0) return setErr('Amount must be > 0');

        try {
            setLoading(true);

            const payload = {
                itemName: form.itemName.trim(),
                category: form.category,
                amount: amountNum,
                paidAt: form.paidAt ? new Date(form.paidAt).toISOString() : undefined,
                paidById: form.paidById,
                shared: form.shared,
                splitPercentForPayer: form.shared ? Number(form.splitPercentForPayer) : undefined,
                notes: form.notes?.trim() || undefined
            };

            await api.post('/purchases', payload, { withCredentials: true });
            setOk(true);
            setForm(f => ({
                ...f,
                itemName: '',
                amount: '',
                notes: ''
            }));
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
            <div className="purchase-form-rim"></div>
            <div className="purchase-form-glow"></div>
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
                            name="category"
                            value={form.category}
                            onChange={onChange}
                            className="purchase-form-inner-grid-field-input"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{labelForCategory(c)}</option>
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
                            {users.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
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
                                step="0.1"
                                min="0"
                                value={form.amount}
                                onChange={onChange}
                                placeholder="0.00"
                            />
                        </div>
                    </label>

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
                            {form.shared ? 'Split between payer and the other user' : 'Only the payer covers this expense'}
                        </small>
                    </div>

                    {form.shared && (
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