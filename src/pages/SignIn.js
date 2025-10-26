import React, {useEffect, useRef, useState} from 'react';
import LoginForm from '../components/SignInForm';

export default function Register() {
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
            <LoginForm />
        </main>
    );
}