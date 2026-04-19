import { useEffect, useMemo, useRef, useState } from "react";
import { useAnimationMode } from "./AnimationMode";

function usePrefersReducedMotion() {
    return useMemo(() => {
        if (typeof window === "undefined" || !window.matchMedia) return false;
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }, []);
}

export default function useSidebarTransition({
                                                 initialCollapsed = false,
                                                 outMs = 300,
                                                 widthMs = 300,
                                                 inMs = 300,
                                                 openWidth = "18em",
                                                 closedWidth = "5em",
                                                 easing = "cubic-bezier(.175, .685, .32, 1)",
                                                 storageKey = "sidebar:collapsed",
                                                 animated,
                                             } = {}) {
    const { isStatic } = useAnimationMode(animated);

    const [phase, setPhase] = useState(initialCollapsed ? "closed" : "open");
    const timeouts = useRef([]);

    const [iconHidden, setIconHidden] = useState(initialCollapsed);

    const clearTimers = () => {
        timeouts.current.forEach(clearTimeout);
        timeouts.current = [];
    };

    useEffect(() => clearTimers, []);

    const isCollapsed = phase === "closed";
    const isAnimating =
        phase === "closing-out" ||
        phase === "closing-shrink" ||
        phase === "opening-grow" ||
        phase === "opening-in";

    useEffect(() => {
        if (phase === "open" || phase === "closed") {
            try {
                localStorage.setItem(storageKey, phase === "closed" ? "1" : "0");
            } catch {}
        }
    }, [phase, storageKey]);

    const toggle = () => {
        if (isAnimating) return;

        if (isStatic) {
            if (phase === "open") {
                setIconHidden(true);
                setPhase("closed");
            } else {
                setIconHidden(false);
                setPhase("open");
            }
            return;
        }

        if (phase === "open") {
            setPhase("closing-out");
            timeouts.current.push(
                setTimeout(() => {
                    setIconHidden(true);
                    setPhase("closing-shrink");
                    timeouts.current.push(setTimeout(() => setPhase("closed"), widthMs));
                }, outMs)
            );
        } else {
            setIconHidden(false);
            setPhase("opening-grow");
            timeouts.current.push(
                setTimeout(() => {
                    setPhase("opening-in");
                    timeouts.current.push(setTimeout(() => setPhase("open"), inMs));
                }, widthMs)
            );
        }
    };

    const sidebarWidth =
        phase === "closed" || phase === "closing-shrink" ? closedWidth : openWidth;

    const sidebarStyle = {
        width: sidebarWidth,
        transition: isStatic ? "none" : `width ${widthMs}ms ${easing}`,
    };

    const navStyle = {
        left: sidebarWidth,
        right: 0,
        transition: isStatic ? "none" : `left ${widthMs}ms ${easing}`,
    };

    const mainStyle = {
        marginLeft: sidebarWidth,
        transition: isStatic ? "none" : `margin-left ${widthMs}ms ${easing}`,
    };

    const iconShouldBeOpaque =
        phase === "open" || phase === "opening-in";
    const iconIsFadingOut = phase === "closing-out";
    const iconIsFadingIn = phase === "opening-in";

    const iconStyle = {
        opacity: iconShouldBeOpaque ? 1 : 0,
        transition: isStatic
            ? "none"
            : iconIsFadingOut
                ? `opacity ${outMs}ms ${easing}`
                : iconIsFadingIn
                    ? `opacity ${inMs}ms ${easing}`
                    : "none",
        pointerEvents: iconHidden ? "none" : undefined,
    };

    const visualCollapsed =
        phase === "closing-out"   ||
        phase === "closing-shrink"||
        phase === "closed"        ||
        phase === "opening-grow";

    return {
        phase,
        isCollapsed,
        isAnimating,
        toggle,
        sidebarStyle,
        navStyle,
        mainStyle,
        iconStyle,
        iconHidden,
        visualCollapsed,
    };
}
