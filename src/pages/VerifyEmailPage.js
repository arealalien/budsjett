import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useSearchParams, NavLink } from 'react-router-dom';
import Button from "../components/Button";
import { useToast } from '../components/utils/ToastContext';
import LoginForm from "../components/SignInForm";

export default function VerifyEmailPage() {
    const [sp] = useSearchParams();
    const token = sp.get('token');
    const [msg, setMsg] = useState('Verifying…');
    const [ok, setOk] = useState(false);
    const { showToast } = useToast();

    const ref = useRef(null);
    const [cols, setCols] = useState(0);
    const [rows, setRows] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const cell = 100;
        const update = () => {
            const c = Math.max(1, Math.floor(el.clientWidth / cell));
            const r = Math.max(1, Math.floor(el.clientHeight / cell));
            setCols(c);
            setRows(r);
        };

        const ro = new ResizeObserver(update);
        ro.observe(el);
        update();

        return () => ro.disconnect();
    }, []);

    const total = cols * rows;

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
        <main className="register" ref={ref}>
            <div className="register-transition"></div>
            <div
                className="register-grid"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    pointerEvents: "none",
                }}
            >
                {Array.from({ length: total }).map((_, i) => (
                    <div
                        key={i}
                        className="register-grid-box"
                        style={{
                            aspectRatio: "1 / 1",
                        }}
                    />
                ))}
            </div>
            <div className="register-rim"></div>
            <div className="register-glow register-glow-primary"></div>
            <div className="register-glow register-glow-secondary"></div>
            <div className="register-glow register-glow-tertiary"></div>
            <form className="success-panel view-width-home">
                <div className="success-panel-inner">
                    <div className="success-panel-inner-left">
                        <div className="success-panel-inner-left-background">
                            <div className="success-panel-inner-left-background-glow register-form-glow-primary"></div>
                            <div className="success-panel-inner-left-background-glow register-form-glow-secondary"></div>
                            <div className="success-panel-inner-left-background-glow register-form-glow-tertiary"></div>
                        </div>
                    </div>
                    <div className="success-panel-inner-right">
                        <div className="success-panel-inner-header">
                            <h3>{ok ? 'Email Verified' : 'Verification failed'}</h3>
                            <h4>{ok ? 'You can now sign in' : msg}</h4>
                        </div>

                        {ok ? (
                            <div className="success-panel-inner-content">
                                <p>{msg}</p>
                                <NavLink to="/signin">
                                    <Button className="ba-purple" children="Sign in" />
                                </NavLink>
                            </div>
                        ) : (
                            <></>
                        )}
                    </div>
                </div>
            </form>
        </main>
    );
}
