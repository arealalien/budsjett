import React, { useEffect, useState } from 'react';
import { api } from './lib/api';
import { useSearchParams, NavLink } from 'react-router-dom';

export default function VerifyEmailPage() {
    const [sp] = useSearchParams();
    const token = sp.get('token');
    const [msg, setMsg] = useState('Verifying…');
    const [ok, setOk] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get('/auth/verify', { params: { token } });
                setOk(true);
                setMsg(data?.message || 'Email verified.');
            } catch (e) {
                setOk(false);
                setMsg(e.response?.data?.error || e.message);
            }
        })();
    }, [token]);

    return (
        <div>
            <h3>{ok ? 'Success' : 'Verification'}</h3>
            <p>{msg}</p>
            {ok ? <NavLink to="/signin">Go to sign in</NavLink> : null}
        </div>
    );
}
