import { useEffect, useRef, useState } from "react";

/**
 * Drives a hover animation and eases back to rest on mouse leave.
 * mode: "rotate" | "scale"
 * amplitude: number (deg for rotate, scalar delta for scale e.g. 0.1 = +10%)
 * speed: oscillations per second
 * returnDuration: ms for easing back to rest
 */
export default function useHoverOscillation({
                                                mode = "rotate",
                                                amplitude = mode === "rotate" ? 20 : 0.1,
                                                speed = 1.2,
                                                returnDuration = 250,
                                            } = {}) {
    const [hovered, setHovered] = useState(false);
    const [value, setValue] = useState(0); // deg for rotate, delta for scale
    const rafRef = useRef();
    const startRef = useRef();
    const animatingRef = useRef(false);
    const reduceMotion = useRef(
        typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ).current;

    // start/stop hover oscillation
    useEffect(() => {
        if (reduceMotion) return; // respect reduced motion

        cancelAnimationFrame(rafRef.current);

        if (hovered) {
            animatingRef.current = true;
            startRef.current = undefined;

            const tick = (t) => {
                if (startRef.current == null) startRef.current = t;
                const elapsed = (t - startRef.current) / 1000; // seconds
                const wiggle = Math.sin(elapsed * speed * Math.PI * 2) * amplitude;
                setValue(wiggle);
                rafRef.current = requestAnimationFrame(tick);
            };

            rafRef.current = requestAnimationFrame(tick);
        } else {
            // ease back to 0 smoothly
            const start = performance.now();
            const startVal = value;
            animatingRef.current = false;

            const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

            const back = (now) => {
                const p = Math.min((now - start) / returnDuration, 1);
                const eased = startVal * (1 - easeOutCubic(p));
                setValue(eased);
                if (p < 1) rafRef.current = requestAnimationFrame(back);
            };

            rafRef.current = requestAnimationFrame(back);
        }

        return () => cancelAnimationFrame(rafRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hovered]);

    // build a style transform
    const style =
        mode === "rotate"
            ? { transform: `rotate(${reduceMotion ? 0 : value}deg)` }
            : { transform: `scale(${reduceMotion ? 1 : 1 + value})` };

    const handlers = {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setHovered(true), // keyboard focus also animates
        onBlur: () => setHovered(false),
    };

    // add a subtle transition for non-animating state
    const transition =
        mode === "rotate"
            ? "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)"
            : "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)";

    return { style: { ...style, transition }, handlers };
}
