import React, { useEffect, useState } from 'react';
import { api } from './lib/api';
import { useSearchParams, NavLink } from 'react-router-dom';
import Button from "./components/Button";
import { useToast } from './components/ToastContext';

export default function VerifyEmailPage() {
    const [sp] = useSearchParams();
    const token = sp.get('token');
    const [msg, setMsg] = useState('Verifying…');
    const [ok, setOk] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/auth/verify', { params: { token } });
                setOk(true);
                setMsg(data?.message || 'Email verified.');
                showToast(data?.message || 'Email verified.', { type: 'success', duration: 2500 });
            } catch (e) {
                setOk(false);
                setMsg(e.response?.data?.error || e.message);
                showToast(e.response?.data?.error || e.message, { type: 'error', duration: 3500 });
            }
        })();
    }, [token]);

    return (
        <main className="verify">
            <div className="verify-email">
                <div className="verify-email-rim"></div>
                <div className="verify-email-glow"></div>
                <div className="verify-email-inner">
                    <h3 className="verify-email-inner-title">{ok ? 'Success' : 'Verification'}</h3>
                    <p className="verify-email-inner-subtitle">{msg}</p>
                    {ok ? <NavLink to="/signin">
                        <Button className="ba-green" children="Sign in" />
                    </NavLink> : null}
                </div>
            </div>
        </main>
    );
}
