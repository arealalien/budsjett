import React, { useState } from 'react';
import { NavLink, useNavigate } from "react-router-dom";
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import Button from "./Button";


export default function LoginForm() {
    const [form, setForm] = useState({
        usernameOrEmail: '',
        password: '',
        remember: false
    });
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState('');
    const [success, setSuccess] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const { showToast } = useToast();

    const onChange = e => {
        const { name, value, type, checked } = e.target;
        setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
    };

    const onSubmit = async e => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setSuccess(false);

        try {
            const { data } = await api.post('/auth/login', form);
            setSuccess(true);
            setUser(data);
            navigate('/');
            showToast('Logged in successfully', { type: 'success', duration: 2500 });
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            showToast(msg, { type: 'error', duration: 3500 });
        } finally {
            setLoading(false);
        }
    };


    return (
        <form className="register-form signin-form" autocomplete="on" onSubmit={onSubmit}>
            <div className="register-form-rim"></div>
            <div className="register-form-glow"></div>
            <div className="register-form-inner">
                <div className="register-form-inner-header">
                    <h3>Sign in</h3>
                </div>

                <fieldset className="register-form-inner-field rfi-double">
                    <label className="register-form-inner-field-label">
                        <span className="register-form-inner-field-label-name">Username</span>
                        <div className="register-form-inner-field-input">
                            <input
                                className="register-form-inner-field-input-field"
                                name="usernameOrEmail"
                                placeholder="Username or email"
                                value={form.usernameOrEmail}
                                onChange={onChange}
                                autoComplete="email"
                                required
                            />
                            <p className="register-form-inner-field-input-text">@</p>
                        </div>
                    </label>
                    <label className="register-form-inner-field-label">
                        <span className="register-form-inner-field-label-name">Password</span>
                        <div className="register-form-inner-field-input">
                            <input
                                className="register-form-inner-field-input-field"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Password"
                                value={form.password}
                                onChange={onChange}
                                required
                            />
                            {showPassword ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="register-form-inner-field-input-icon" onClick={() => setShowPassword(!showPassword)}>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M15.1643 12.0522C15.1643 13.7982 13.7483 15.2142 12.0023 15.2142C10.2563 15.2142 8.84033 13.7982 8.84033 12.0522C8.84033 10.3052 10.2563 8.89023 12.0023 8.89023C13.7483 8.89023 15.1643 10.3052 15.1643 12.0522Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path fillRule="evenodd" clipRule="evenodd" d="M2.75024 12.0522C2.75024 15.3322 6.89224 19.3542 12.0022 19.3542C17.1112 19.3542 21.2542 15.3352 21.2542 12.0522C21.2542 8.76921 17.1112 4.75021 12.0022 4.75021C6.89224 4.75021 2.75024 8.77221 2.75024 12.0522Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="register-form-inner-field-input-icon" onClick={() => setShowPassword(!showPassword)}>
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

                <fieldset className="register-form-inner-field">
                    <label className="register-form-inner-field-checkbox">
                        <input
                            className="check-deeppink"
                            name="remember"
                            type="checkbox"
                            checked={form.remember}
                            onChange={onChange}
                        />
                        Remember me
                    </label>
                </fieldset>

                {error && <p style={{ color: 'crimson' }}>{error}</p>}

                <div className="register-form-inner-bottom">
                    <Button className="ba-deeppink" children="Sign in" type="submit" disabled={loading} />
                    <NavLink to="/register">
                        <Button className="ba-white reversed" children="Register" />
                    </NavLink>
                </div>
            </div>
        </form>
    );
}