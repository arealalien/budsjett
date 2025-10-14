import React, { useEffect, useMemo, useRef, useState } from "react";

/* ---------- color utils ---------- */
const EPS = 1e-4;
const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const clamp255 = (n) => Math.min(255, Math.max(0, Math.round(n)));
const clamp255f = (n) => Math.min(255, Math.max(0, n));

function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    const s = max === 0 ? 0 : d / max;
    const v = max;
    return { h, s, v };
}

function hsvToRgb(h, s, v) {
    h = (h % 1 + 1) % 1;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    let r, g, b;
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        default: r = v; g = p; b = q; break;
    }
    return { r: clamp255f(r * 255), g: clamp255f(g * 255), b: clamp255f(b * 255) };
}

function parseRgbString(str) {
    const parts = (str || "").trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    return parts.map((n) => Math.min(255, Math.max(0, Math.round(n))));
}
const toRgbString = ([r, g, b]) => `${r}, ${g}, ${b}`;

/* ---------- component ---------- */
export default function ColorPicker({
                                        value,                 // "R, G, B"
                                        onChange,              // (nextRgbString) => void
                                        label = "Color",
                                        className = "",
                                        commitOnEnd = false,   // if true: emit only on pointerup (smoother in lists)
                                    }) {
    // parse prop once per change
    const parsed = useMemo(() => parseRgbString(value) || [239, 68, 68], [value]);
    const propHsv = useMemo(() => rgbToHsv(parsed[0], parsed[1], parsed[2]), [parsed]);

    // internal state (floats)
    const [hsv, setHsv] = useState(propHsv);

    // dragging gate: ignore external prop while dragging to avoid jitter
    const dragging = useRef(false);
    useEffect(() => {
        if (!dragging.current) setHsv(propHsv);
    }, [propHsv]);

    // derived rgb (floats for UI), plus rounded string for parent
    const rgb = useMemo(() => hsvToRgb(hsv.h, hsv.s, hsv.v), [hsv]);
    const rgbStrRounded = `${clamp255(rgb.r)}, ${clamp255(rgb.g)}, ${clamp255(rgb.b)}`;

    // throttle onChange with rAF
    const rafId = useRef(0);
    const lastSent = useRef("");
    const emitChange = (str) => {
        if (commitOnEnd) return; // emit later on release
        if (str === lastSent.current) return;
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
            lastSent.current = str;
            onChange?.(str);
        });
    };
    useEffect(() => () => rafId.current && cancelAnimationFrame(rafId.current), []);

    // Pointer math helpers
    const svRef = useRef(null);
    const hueRef = useRef(null);

    const moveSV = (clientX, clientY) => {
        const el = svRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        let x = (clientX - r.left) / Math.max(1, r.width);
        let y = (clientY - r.top) / Math.max(1, r.height);
        x = clamp(x, 0 + EPS, 1 - EPS);
        y = clamp(y, 0 + EPS, 1 - EPS);
        setHsv((h) => {
            const next = { ...h, s: x, v: 1 - y };
            emitChange(`${clamp255(hsvToRgb(next.h, next.s, next.v).r)}, ${clamp255(hsvToRgb(next.h, next.s, next.v).g)}, ${clamp255(hsvToRgb(next.h, next.s, next.v).b)}`);
            return next;
        });
    };

    const moveHue = (clientX) => {
        const el = hueRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        let x = (clientX - r.left) / Math.max(1, r.width);
        x = clamp(x, 0 + EPS, 1 - EPS);
        setHsv((h) => {
            const next = { ...h, h: x };
            emitChange(`${clamp255(hsvToRgb(next.h, next.s, next.v).r)}, ${clamp255(hsvToRgb(next.h, next.s, next.v).g)}, ${clamp255(hsvToRgb(next.h, next.s, next.v).b)}`);
            return next;
        });
    };

    // Pointer bindings (no window listeners)
    const onSVPointerDown = (e) => {
        dragging.current = true;
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
        moveSV(e.clientX, e.clientY);
    };
    const onSVPointerMove = (e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
        moveSV(e.clientX, e.clientY);
    };
    const onSVPointerUp = (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragging.current = false;
        if (commitOnEnd) onChange?.(rgbStrRounded);
    };

    const onHuePointerDown = (e) => {
        dragging.current = true;
        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);
        if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
        moveHue(e.clientX);
    };
    const onHuePointerMove = (e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        if (e.pointerType === "touch" && e.cancelable) e.preventDefault();
        moveHue(e.clientX);
    };
    const onHuePointerUp = (e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        dragging.current = false;
        if (commitOnEnd) onChange?.(rgbStrRounded);
    };

    // direct numeric RGB editing (immediate commit)
    const setRgbDirect = (idx, val) => {
        const next = [...parsed];
        next[idx] = Math.min(255, Math.max(0, Number(val) || 0));
        const { h, s, v } = rgbToHsv(next[0], next[1], next[2]);
        setHsv({ h, s, v });
        lastSent.current = toRgbString(next);
        onChange?.(lastSent.current);
    };

    // SV background uses full-sat/value hue
    const hueRgb = hsvToRgb(hsv.h, 1, 1);
    const hueCss = `rgb(${clamp255(hueRgb.r)}, ${clamp255(hueRgb.g)}, ${clamp255(hueRgb.b)})`;

    return (
        <div className={`colorpicker-inner ${className}`}>
            <label className="colorpicker-label">{label}</label>

            {/* SV Square */}
            <div className="colorpicker-box">
                <div className="colorpicker-box-preview" style={{ background: `rgb(${rgbStrRounded})` }} />
                <div
                    className="colorpicker-box-graph"
                    ref={svRef}
                    role="slider"
                    aria-label="Saturation/Value"
                    aria-valuetext={`S: ${Math.round(hsv.s * 100)}%, V: ${Math.round(hsv.v * 100)}%`}
                    style={{
                        background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, transparent),
            ${hueCss}
          `,
                        touchAction: "none",
                    }}
                    onPointerDown={onSVPointerDown}
                    onPointerMove={onSVPointerMove}
                    onPointerUp={onSVPointerUp}
                    onPointerCancel={onSVPointerUp}
                >
                    <div
                        className="colorpicker-box-graph-thumb"
                        style={{
                            left: `${clamp(hsv.s, EPS, 1 - EPS) * 100}%`,
                            top: `${clamp(1 - hsv.v, EPS, 1 - EPS) * 100}%`,
                            background: `rgb(${rgbStrRounded})`,
                        }}
                    />
                </div>
            </div>

            {/* Hue Slider */}
            <div
                className="colorpicker-hue"
                ref={hueRef}
                role="slider"
                aria-label="Hue"
                style={{ touchAction: "none" }}
                onPointerDown={onHuePointerDown}
                onPointerMove={onHuePointerMove}
                onPointerUp={onHuePointerUp}
                onPointerCancel={onHuePointerUp}
            >
                <div className="colorpicker-hue-gradient" />
                <div className="colorpicker-hue-thumb" style={{ left: `${clamp(hsv.h, EPS, 1 - EPS) * 100}%` }} />
            </div>

            {/* Preview + numeric inputs */}
            <div className="colorpicker-row">
                <div className="colorpicker-row-rgb">
                    <label>
                        R
                        <input type="number" min="0" max="255" value={parsed[0]} onChange={(e) => setRgbDirect(0, e.target.value)} />
                    </label>
                    <label>
                        G
                        <input type="number" min="0" max="255" value={parsed[1]} onChange={(e) => setRgbDirect(1, e.target.value)} />
                    </label>
                    <label>
                        B
                        <input type="number" min="0" max="255" value={parsed[2]} onChange={(e) => setRgbDirect(2, e.target.value)} />
                    </label>
                    <input
                        className="colorpicker-row-rgb-rgbstr"
                        type="text"
                        value={rgbStrRounded}
                        onChange={(e) => {
                            const p = parseRgbString(e.target.value);
                            if (p) {
                                const { h, s, v } = rgbToHsv(p[0], p[1], p[2]);
                                setHsv({ h, s, v });
                                lastSent.current = toRgbString(p);
                                onChange?.(lastSent.current);
                            }
                        }}
                        onBlur={(e) => {
                            const p = parseRgbString(e.target.value) || parsed;
                            lastSent.current = toRgbString(p);
                            onChange?.(lastSent.current);
                        }}
                        placeholder="R, G, B"
                    />
                </div>
            </div>
        </div>
    );
}