import React, { useMemo, useRef, useState, useEffect } from 'react';

function parseCornerRadius(radius, width, height) {
    const minSide = Math.min(width, height);

    if (typeof radius === 'number') {
        return Math.max(0, Math.min(radius, minSide / 2));
    }

    if (typeof radius === 'string' && radius.endsWith('%')) {
        const pct = Number.parseFloat(radius);
        if (Number.isFinite(pct)) {
            return Math.max(0, Math.min((pct / 100) * minSide, minSide / 2));
        }
    }

    return Math.min(minSide * 0.22, minSide / 2);
}

function makeRectSquirclePolygon({
                                     width,
                                     height,
                                     radius = '22%',
                                     n = 5,
                                     steps = 20,
                                 }) {
    if (!width || !height) return null;

    const r = parseCornerRadius(radius, width, height);
    const pts = [];

    const sinPow = (t) => Math.pow(Math.sin(t), 2 / n);
    const cosPow = (t) => Math.pow(Math.cos(t), 2 / n);

    const push = (x, y) => {
        pts.push(`${x}px ${y}px`);
    };

    push(r, 0);

    for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * (Math.PI / 2);
        push(
            width - r + r * sinPow(t),
            r - r * cosPow(t)
        );
    }

    for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * (Math.PI / 2);
        push(
            width - r + r * cosPow(t),
            height - r + r * sinPow(t)
        );
    }

    for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * (Math.PI / 2);
        push(
            r - r * sinPow(t),
            height - r + r * cosPow(t)
        );
    }

    for (let i = 0; i <= steps; i += 1) {
        const t = (i / steps) * (Math.PI / 2);
        push(
            r - r * cosPow(t),
            r - r * sinPow(t)
        );
    }

    return `polygon(${pts.join(', ')})`;
}

function useElementSize(ref) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!ref.current) return;

        const el = ref.current;

        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize({
                width: rect.width,
                height: rect.height,
            });
        };

        update();

        const observer = new ResizeObserver(update);
        observer.observe(el);

        return () => observer.disconnect();
    }, [ref]);

    return size;
}

export function SquircleFrame({
                                  as: Comp = 'div',
                                  children,
                                  className = '',
                                  n = 5,
                                  steps = 20,
                                  radius = '22%',
                                  inset = 1,
                                  style = {},
                                  innerClassName = '',
                                  innerStyle = {},
                                  ...rest
                              }) {
    const ref = useRef(null);
    const { width, height } = useElementSize(ref);

    const outerClip = useMemo(() => {
        return makeRectSquirclePolygon({
            width,
            height,
            radius,
            n,
            steps,
        });
    }, [width, height, radius, n, steps]);

    const innerClip = useMemo(() => {
        if (!width || !height) return null;

        const innerWidth = Math.max(0, width - inset * 2);
        const innerHeight = Math.max(0, height - inset * 2);

        const outerRadiusPx = parseCornerRadius(radius, width, height);
        const innerRadiusPx = Math.max(0, outerRadiusPx - inset);

        return makeRectSquirclePolygon({
            width: innerWidth,
            height: innerHeight,
            radius: innerRadiusPx,
            n,
            steps,
        });
    }, [width, height, radius, inset, n, steps]);

    return (
        <Comp
            ref={ref}
            className={`squircle-frame ${className}`}
            style={{
                ...style,
                '--squircle-clip-outer': outerClip || 'none',
                '--squircle-clip-inner': innerClip || 'none',
                '--squircle-inset': `${inset}px`,
            }}
            {...rest}
        >
            <div className="squircle-frame-glow" />
            <div
                className={`squircle-frame-inner ${innerClassName}`}
                style={innerStyle}
            >
                {children}
                <div className="squircle-frame-inner-glow" />
            </div>
        </Comp>
    );
}