import React, {useEffect, useMemo, useRef, useState} from "react";
import { useLocation, useNavigate, NavLink } from "react-router-dom";
import { api } from "../lib/api";
import Button from "../components/Button";
import { useToast } from "../components/utils/ToastContext";
import LoginForm from "../components/SignInForm";

function useQuery() {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search), [search]);
}

export default function ResetPasswordPage() {
    const q = useQuery();
    const token = q.get("token") || "";
    const navigate = useNavigate();

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

    const [form, setForm] = useState({
        password: "",
        confirmPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const onChange = (e) => {
        const { name, value } = e.target;
        setForm((f) => ({ ...f, [name]: value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!token) {
            showToast("Missing reset token.", { type: "error" });
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/password/reset", {
                token,
                password: form.password,
                confirmPassword: form.confirmPassword,
            });

            showToast("Password updated. You can sign in now.", { type: "success", duration: 3500 });
            navigate("/signin");
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            showToast(msg, { type: "error", duration: 3500 });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="view-width-home" style={{ padding: 24 }}>
                <h3>Invalid reset link</h3>
                <p>This reset link is missing a token. Try requesting a new one.</p>
                <NavLink to="/forgot-password">Request new reset link</NavLink>
            </div>
        );
    }

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
                            <h3 className="register-form-inner-left-background-title">Choose a new<br /> password</h3>
                            <div className="register-form-inner-left-background-glow register-form-glow-primary"></div>
                            <div className="register-form-inner-left-background-glow register-form-glow-secondary"></div>
                            <div className="register-form-inner-left-background-glow register-form-glow-tertiary"></div>
                        </div>
                    </div>

                    <div className="register-form-inner-right">
                        <div className="register-form-inner-header">
                            <h3>Reset password</h3>
                            <p>Enter a new password for your account.</p>
                        </div>

                        <div className="register-form-inner-content">
                            <fieldset className="register-form-inner-content-field">
                                <label className="register-form-inner-content-field-label">
                                    <span className="register-form-inner-content-field-label-name">New password</span>
                                    <div className="register-form-inner-content-field-input">
                                        <input
                                            className="register-form-inner-content-field-input-field"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            value={form.password}
                                            onChange={onChange}
                                            required
                                        />
                                    </div>
                                </label>
                            </fieldset>

                            <fieldset className="register-form-inner-content-field">
                                <label className="register-form-inner-content-field-label">
                                    <span className="register-form-inner-content-field-label-name">Confirm password</span>
                                    <div className="register-form-inner-content-field-input">
                                        <input
                                            className="register-form-inner-content-field-input-field"
                                            name="confirmPassword"
                                            type={showPassword ? "text" : "password"}
                                            value={form.confirmPassword}
                                            onChange={onChange}
                                            required
                                        />
                                    </div>
                                </label>
                            </fieldset>

                            <label className="register-form-inner-content-field-checkbox">
                                <input
                                    type="checkbox"
                                    checked={showPassword}
                                    onChange={() => setShowPassword((v) => !v)}
                                />
                                Show password
                            </label>
                        </div>

                        <div className="register-form-inner-bottom">
                            <Button className="ba-purple" type="submit" disabled={loading}>
                                {loading ? "Updating..." : "Update password"}
                            </Button>
                            <p>Back to <NavLink to="/signin">Sign in</NavLink></p>
                        </div>
                    </div>
                </div>
            </form>
        </main>
    );
}
