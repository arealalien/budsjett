import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from "react-router-dom";
import { api } from '../lib/api';
import Button from './Button';
import { useToast } from './utils/ToastContext';
import { useAvailability } from './hooks/useAvailability';

const RESEND_COOLDOWN_SEC = 60;

export default function RegisterForm() {
    const [form, setForm] = useState({
        displayName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });

    const [verifyLink, setVerifyLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState(false);
    const [strength, setStrength] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // for resend
    const [resendLoading, setResendLoading] = useState(false);
    const [resendError, setResendError] = useState('');
    const [cooldownEnd, setCooldownEnd] = useState(0);

    const { showToast } = useToast();

    const usernameOk = v => v.length >= 8 && /^[A-Za-z0-9_]+$/.test(v);
    const emailOk    = v => /\S+@\S+\.\S+/.test(v);
    const displayOk  = v => v.trim().length >= 2;

    const usernameStatus    = useAvailability('username', form.username, 450, usernameOk);
    const displayNameStatus = useAvailability('displayName', form.displayName, 450, displayOk);
    const emailStatus       = useAvailability('email', form.email, 450, emailOk);

    const cls = (base, s) =>
        [base,
            s === 'taken'   && 'register-taken',
            s === 'free'    && 'register-free',
            s === 'invalid' && 'register-invalid',
            s === 'checking' && 'register-checking'
        ].filter(Boolean).join(' ');

    const CheckingIcon = () => (
        <svg
            className="register-form-inner-content-field-input-icon register-checking-icon"
            viewBox="0 0 50 50"
            aria-hidden="true"
        >
            <circle className="path" cx="25" cy="25" r="20" fill="none" strokeWidth="5" />
        </svg>
    );

    const TakenIcon = () => (
        <svg className="register-form-inner-content-field-input-icon register-taken-icon" width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 9.5L9.5 1" stroke="#E67B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9.5 9.5L1 1" stroke="#E67B4D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );

    const FreeIcon = () => (
        <svg className="register-form-inner-content-field-input-icon register-free-icon" width="12" height="11" viewBox="0 0 12 11" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 6.41676L4.75 9.75009L11 1.00009" stroke="#8A4DE6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );

    const onChange = e => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        if (name === 'password') setStrength(calculateStrength(value));
    };

    const validatePassword = (password) => {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&_])[A-Za-z\d@$!%*?#&_]{8,}$/;
        return regex.test(password);
    };

    const calculateStrength = (password) => {
        if (!password) return 0;
        let score = 0;
        const lowerCount = (password.match(/[a-z]/g) || []).length;
        const upperCount = (password.match(/[A-Z]/g) || []).length;
        const numberCount = (password.match(/\d/g) || []).length;
        const symbolCount = (password.match(/[@$!%*?#&_]/g) || []).length;

        if (password.length >= 8) score += 1;
        if (password.length >= 10) score += 1;
        if (password.length >= 12) score += 1;
        if (password.length >= 16) score += 1;

        if (lowerCount) score += 1;
        if (upperCount) score += 1;
        if (numberCount > 0) score += Math.min(2, Math.ceil(numberCount / 2));
        if (symbolCount > 0) score += Math.min(2, Math.ceil(symbolCount / 2));
        if (lowerCount && upperCount && numberCount && symbolCount) score += 2;

        if (/^[a-zA-Z]+$/.test(password)) score -= 2;
        if (/([a-zA-Z0-9])\1{2,}/.test(password)) score -= 1;
        if (/password/i.test(password)) score -= 3;
        if (password.length < 8) score = 0;

        const sequences = ['abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZ','0123456789'];
        sequences.forEach(seq => {
            for (let i = 0; i < seq.length - 2; i++) {
                const sub = seq.substring(i, i + 3);
                if (password.includes(sub)) { score -= 1; break; }
            }
        });

        return Math.max(0, Math.min(10, score));
    };

    const usernameRegex = /^[A-Za-z0-9_]+$/;

    const onSubmit = async e => {
        e.preventDefault();
        setError('');
        setSuccess(false);
        setVerifyLink('');

        if (!usernameRegex.test(form.username)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }
        if (form.password !== form.confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (!validatePassword(form.password)) {
            setError('Password must be at least 8 chars, include upper, lower, number, and special char');
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post('/auth/register', { ...form });
            setSuccess(true);
            if (data?.devLink) setVerifyLink(data.devLink);
            showToast('Registered! Check your inbox to verify.', { type: 'success', duration: 2800 });

            // start cooldown immediately to avoid spam
            setCooldownEnd(Date.now() + RESEND_COOLDOWN_SEC * 1000);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            showToast(msg, { type: 'error', duration: 3500 });
        } finally {
            setLoading(false);
        }
    };

    const getStrengthLabel = () => {
        if (strength <= 2) return { text: 'Weak', color: '#ef4444', colorAlpha: 'rgba(239, 68, 68, .15)' };
        if (strength === 3 || strength === 4) return { text: 'Medium', color: '#f59e0b', colorAlpha: 'rgba(245, 158, 11, .15)' };
        return { text: 'Strong', color: '#10b981', colorAlpha: 'rgba(16, 185, 129, .15)' };
    };
    const { text: strengthText, color: strengthColor, colorAlpha: strengthColorAlpha } = getStrengthLabel();

    // Cooldown timer
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!success) return;
        const t = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(t);
    }, [success]);
    const secondsLeft = useMemo(() => Math.max(0, Math.ceil((cooldownEnd - now) / 1000)), [cooldownEnd, now]);
    const canResend = success && secondsLeft === 0 && !resendLoading;

    const resend = async () => {
        if (!form.email) return;
        setResendError('');
        setResendLoading(true);
        try {
            const { data } = await api.post('/auth/verify/resend', { email: form.email });
            if (data?.devLink) setVerifyLink(data.devLink);
            showToast('Verification email sent again.', { type: 'success', duration: 2200 });
            setCooldownEnd(Date.now() + RESEND_COOLDOWN_SEC * 1000);
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setResendError(msg);
            showToast(msg, { type: 'error', duration: 3200 });
        } finally {
            setResendLoading(false);
        }
    };

    // --- RENDER ---
    if (success) {
        return (
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
                            <h3>You’re good to go!</h3>
                            <h4>Check your email to begin.</h4>
                        </div>

                        <div className="success-panel-inner-content">
                            <p>Please check your email '<span>{form.email}</span>' and click '<span>Verify my account</span>' button to complete your signup.</p>
                            <a className="success-panel-inner-content-mail" href="https://gmail.com" target="_blank" rel="noopener noreferrer">
                                <img src={process.env.PUBLIC_URL + `google.svg`} alt="" />
                                <span>Open Gmail</span>
                            </a>
                            <p className="success-panel-inner-content-receive">Didn't receive the email? {secondsLeft > 0 ? `Resend code - ${secondsLeft}s` : <span onClick={resend}>Resend email</span>}</p>
                        </div>

                        {resendError && <p style={{ color: 'crimson', marginTop: '.75rem' }}>{resendError}</p>}
                    </div>
                </div>
            </form>
        );
    }

    return (
        <form className="register-form view-width-home" autoComplete="on" onSubmit={onSubmit}>
            <div className="register-form-inner">
                <div className="register-form-inner-left">
                    <div className="register-form-inner-left-background">
                        <h3 className="register-form-inner-left-background-title">Sign up to<br/> Astrae today!</h3>
                        <div className="register-form-inner-left-background-glow register-form-glow-primary"></div>
                        <div className="register-form-inner-left-background-glow register-form-glow-secondary"></div>
                        <div className="register-form-inner-left-background-glow register-form-glow-tertiary"></div>
                    </div>
                </div>
                <div className="register-form-inner-right">
                    <div className="register-form-inner-header">
                        <h3>Register</h3>
                        <p>Register your account to get access to all features.</p>
                        <p>All fields marked “<span>*</span>“ are required.</p>
                    </div>

                    <div className="register-form-inner-content">
                        <fieldset className="register-form-inner-content-field rfi-double">
                            <label className="register-form-inner-content-field-label">
                                <span className="register-form-inner-content-field-label-name">Username <span>*</span></span>
                                <div className="register-form-inner-content-field-input">
                                    <input
                                        className={cls("register-form-inner-content-field-input-field", usernameStatus)}
                                        name="username"
                                        type="text"
                                        placeholder="Username"
                                        value={form.username}
                                        onChange={onChange}
                                        required
                                    />
                                    {usernameStatus === 'checking' && <CheckingIcon />}
                                    {usernameStatus === 'taken' && <TakenIcon />}
                                    {usernameStatus === 'free'  && <FreeIcon  />}
                                </div>
                            </label>
                            <label className="register-form-inner-content-field-label">
                                <span className="register-form-inner-content-field-label-name">Display name <span>*</span></span>
                                <div className="register-form-inner-content-field-input">
                                    <input
                                        className={cls("register-form-inner-content-field-input-field", displayNameStatus)}
                                        type="text"
                                        name="displayName"
                                        placeholder="Display name"
                                        value={form.displayName}
                                        onChange={onChange}
                                        required
                                    />
                                    {displayNameStatus === 'checking' && <CheckingIcon />}
                                    {displayNameStatus === 'taken' && <TakenIcon />}
                                    {displayNameStatus === 'free'  && <FreeIcon  />}
                                </div>
                            </label>
                        </fieldset>

                        <fieldset className="register-form-inner-content-field">
                            <label className="register-form-inner-content-field-label">
                                <span className="register-form-inner-content-field-label-name">Email <span>*</span></span>
                                <div className="register-form-inner-content-field-input">
                                    <input
                                        className={cls("register-form-inner-content-field-input-field", emailStatus)}
                                        type="text"
                                        name="email"
                                        placeholder="Email"
                                        value={form.email}
                                        onChange={onChange}
                                        autoComplete="email"
                                        required
                                    />
                                    {emailStatus === 'checking' && <CheckingIcon />}
                                    {emailStatus === 'taken' && <TakenIcon />}
                                    {emailStatus === 'free'  && <FreeIcon  />}
                                </div>
                            </label>
                        </fieldset>

                        <fieldset className="register-form-inner-content-field rfi-double">
                            <label className="register-form-inner-content-field-label">
                                <span className="register-form-inner-content-field-label-name">Password <span>*</span></span>
                                <div className="register-form-inner-content-field-input">
                                    <input
                                        className="register-form-inner-content-field-input-field"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Password (min 8 chars)"
                                        value={form.password}
                                        onChange={onChange}
                                        required
                                    />
                                    {showPassword ? (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="register-form-inner-content-field-input-icon password-icon" onClick={() => setShowPassword(!showPassword)}>
                                            <path fillRule="evenodd" clipRule="evenodd" d="M15.1643 12.0522C15.1643 13.7982 13.7483 15.2142 12.0023 15.2142C10.2563 15.2142 8.84033 13.7982 8.84033 12.0522C8.84033 10.3052 10.2563 8.89023 12.0023 8.89023C13.7483 8.89023 15.1643 10.3052 15.1643 12.0522Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path fillRule="evenodd" clipRule="evenodd" d="M2.75024 12.0522C2.75024 15.3322 6.89224 19.3542 12.0022 19.3542C17.1112 19.3542 21.2542 15.3352 21.2542 12.0522C21.2542 8.76921 17.1112 4.75021 12.0022 4.75021C6.89224 4.75021 2.75024 8.77221 2.75024 12.0522Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="register-form-inner-content-field-input-icon password-icon" onClick={() => setShowPassword(!showPassword)}>
                                            <path d="M6.42 17.7299C4.19 16.2699 2.75 14.0699 2.75 12.1399C2.75 8.85994 6.89 4.83994 12 4.83994C14.09 4.83994 16.03 5.50994 17.59 6.54994" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M19.8496 8.61032C20.7406 9.74032 21.2596 10.9903 21.2596 12.1403C21.2596 15.4203 17.1096 19.4403 11.9996 19.4403C11.0896 19.4403 10.2006 19.3103 9.36963 19.0803" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M9.7656 14.3671C9.1706 13.7781 8.8376 12.9751 8.8406 12.1381C8.8366 10.3931 10.2486 8.97512 11.9946 8.97212C12.8346 8.97012 13.6406 9.30312 14.2346 9.89712" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M15.1095 12.6992C14.8755 13.9912 13.8645 15.0042 12.5725 15.2412" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M19.8917 4.25003L4.11768 20.024" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </div>
                            </label>
                            <label className="register-form-inner-content-field-label">
                                <span className="register-form-inner-content-field-label-name">Confirm Password <span>*</span></span>
                                <div className="register-form-inner-content-field-input">
                                    <input
                                        className="register-form-inner-content-field-input-field"
                                        name="confirmPassword"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="Confirm Password"
                                        value={form.confirmPassword}
                                        onChange={onChange}
                                        autoComplete="new-password"
                                        required
                                    />
                                    {showConfirmPassword ? (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="register-form-inner-content-field-input-icon password-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                            <path fillRule="evenodd" clipRule="evenodd" d="M15.1643 12.0522C15.1643 13.7982 13.7483 15.2142 12.0023 15.2142C10.2563 15.2142 8.84033 13.7982 8.84033 12.0522C8.84033 10.3052 10.2563 8.89023 12.0023 8.89023C13.7483 8.89023 15.1643 10.3052 15.1643 12.0522Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path fillRule="evenodd" clipRule="evenodd" d="M2.75024 12.0522C2.75024 15.3322 6.89224 19.3542 12.0022 19.3542C17.1112 19.3542 21.2542 15.3352 21.2542 12.0522C21.2542 8.76921 17.1112 4.75021 12.0022 4.75021C6.89224 4.75021 2.75024 8.77221 2.75024 12.0522Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="register-form-inner-content-field-input-icon password-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                            <path d="M6.42 17.7299C4.19 16.2699 2.75 14.0699 2.75 12.1399C2.75 8.85994 6.89 4.83994 12 4.83994C14.09 4.83994 16.03 5.50994 17.59 6.54994" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M19.8496 8.61032C20.7406 9.74032 21.2596 10.9903 21.2596 12.1403C21.2596 15.4203 17.1096 19.4403 11.9996 19.4403C11.0896 19.4403 10.2006 19.3103 9.36963 19.0803" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M9.7656 14.3671C9.1706 13.7781 8.8376 12.9751 8.8406 12.1381C8.8366 10.3931 10.2486 8.97512 11.9946 8.97212C12.8346 8.97012 13.6406 9.30312 14.2346 9.89712" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M15.1095 12.6992C14.8755 13.9912 13.8645 15.0042 12.5725 15.2412" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            <path d="M19.8917 4.25003L4.11768 20.024" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                        </svg>
                                    )}
                                </div>
                            </label>
                        </fieldset>

                        {form.password && (
                            <fieldset className="register-form-inner-content-field pass-strength">
                                <p className="register-form-inner-content-field-indicator" style={{ color: strengthColor }}>{strengthText}</p>
                                <div className="register-form-inner-content-field-line">
                                    <div className="register-form-inner-content-field-line-inner" style={{ width: `${(strength / 5) * 100}%`, background: strengthColor }} />
                                </div>
                            </fieldset>
                        )}

                        <fieldset className="register-form-inner-content-field">
                            <label className="register-form-inner-content-field-checkbox">
                                <input
                                    className="check-purple"
                                    name="remember"
                                    type="checkbox"
                                />
                                I confirm that i have read and agree to the Client agreement, Terms of Service and legal policies.
                            </label>
                        </fieldset>
                    </div>

                    {error && <p style={{ color: 'crimson' }}>{error}</p>}

                    <div className="register-form-inner-bottom">
                        <Button className="ba-purple" type="submit" disabled={loading}>
                            {loading ? 'Register' : 'Register'}
                        </Button>
                        <p>Already have an account? <NavLink to="/signin">Sign in</NavLink></p>
                    </div>
                </div>
            </div>
        </form>
    );
}
