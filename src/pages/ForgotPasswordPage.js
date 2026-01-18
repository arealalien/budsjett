import React, {useEffect, useRef, useState} from "react";
import { NavLink } from "react-router-dom";
import { api } from "../lib/api";
import Button from "../components/Button";
import { useToast } from "../components/utils/ToastContext";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const ref = useRef(null);
    const [cols, setCols] = useState(0);
    const [rows, setRows] = useState(0);

    const { showToast } = useToast();

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

    const onSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data } = await api.post("/auth/password/forgot", { email });

            setSent(true);
            showToast("If that email exists, we sent a reset link.", { type: "success", duration: 3500 });

            if (data?.devLink) console.log("DEV reset link:", data.devLink);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            showToast(msg, { type: "error", duration: 3500 });
        } finally {
            setLoading(false);
        }
    };

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
            <form className="register-form signin-form view-width-home" onSubmit={onSubmit}>
                <div className="register-form-inner">
                    <div className="register-form-inner-left">
                        <div className="register-form-inner-left-background">
                            <h3 className="register-form-inner-left-background-title">Reset your<br /> password</h3>
                            <div className="register-form-inner-left-background-glow register-form-glow-primary"></div>
                            <div className="register-form-inner-left-background-glow register-form-glow-secondary"></div>
                            <div className="register-form-inner-left-background-glow register-form-glow-tertiary"></div>
                        </div>
                    </div>

                    <div className="register-form-inner-right">
                        <div className="register-form-inner-header">
                            <h3>Forgot password</h3>
                            <p>Enter your email and we’ll send you a reset link.</p>
                        </div>

                        {!sent ? (
                            <>
                                <div className="register-form-inner-content">
                                    <fieldset className="register-form-inner-content-field">
                                        <label className="register-form-inner-content-field-label">
                                            <span className="register-form-inner-content-field-label-name">Email</span>
                                            <div className="register-form-inner-content-field-input">
                                                <input
                                                    className="register-form-inner-content-field-input-field"
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    placeholder="you@example.com"
                                                    autoComplete="email"
                                                    required
                                                />
                                            </div>
                                        </label>
                                    </fieldset>
                                </div>

                                <div className="register-form-inner-bottom">
                                    <Button className="ba-purple" type="submit" disabled={loading}>
                                        {loading ? "Sending..." : "Send reset link"}
                                    </Button>
                                    <p>Back to <NavLink to="/signin">Sign in</NavLink></p>
                                </div>
                            </>
                        ) : (
                            <div className="register-form-inner-content">
                                <p>
                                    If an account exists for <span>{email}</span>, you’ll receive an email with a reset link shortly.
                                </p>
                                <p>Back to <NavLink to="/signin">Sign in</NavLink></p>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </main>
    );
}
