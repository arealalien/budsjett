import React, { useRef, useEffect, useState } from "react";
import WordsPullUp from "../utils/WordsPullUp";

export default function Header() {
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
        <header className="landing-header" ref={ref}>
            <div className="landing-header-transition"></div>
            <div
                className="landing-header-grid"
                style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    pointerEvents: "none",
                }}
            >
                {Array.from({ length: total }).map((_, i) => (
                    <div
                        key={i}
                        className="landing-header-grid-box"
                        style={{
                            aspectRatio: "1 / 1",
                        }}
                    />
                ))}
            </div>
            <div className="landing-header-rim"></div>
            <div className="landing-header-glow header-glow-primary"></div>
            <div className="landing-header-glow header-glow-secondary"></div>
            <div className="landing-header-glow header-glow-tertiary"></div>
            <div className="landing-header-top view-width-home" style={{ position: "relative", zIndex: 1 }}>
                <h1 className="landing-header-top-title">
                    <WordsPullUp text="Astrae is" />
                    <br />
                    <WordsPullUp text="your personal" className="header-fade" delay={0.2} />
                    <br />
                    <WordsPullUp text="accountant" className="header-indent" delay={0.4} />
                </h1>
            </div>
            <div className="landing-header-center"></div>
        </header>
    );
}
