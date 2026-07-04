import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_ROOT_FONT_SIZE = 16;

function lengthToPx(value, fallbackPx) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    const raw = String(value || "").trim();
    const amount = Number.parseFloat(raw);
    if (!Number.isFinite(amount)) return fallbackPx;

    if (raw.endsWith("px")) return amount;

    if (raw.endsWith("rem") || raw.endsWith("em")) {
        const rootFontSize = typeof window === "undefined"
            ? DEFAULT_ROOT_FONT_SIZE
            : Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || DEFAULT_ROOT_FONT_SIZE;

        return amount * rootFontSize;
    }

    return fallbackPx;
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export default function useSidebarTransition({
                                                 initialCollapsed = false,
                                                 initialOpenWidth = null,
                                                 openWidth = "18em",
                                                 closedWidth = "5em",
                                                 minOpenWidth = "14em",
                                                 maxOpenWidth = "32em",
                                                 collapseThreshold = "10em",
                                                 expandThreshold = "12em",
                                                 storageKey = "sidebar:collapsed",
                                                 onCollapsedChange,
                                                 onOpenWidthChange,
                                             } = {}) {
    const [phase, setPhase] = useState(initialCollapsed ? "closed" : "open");
    const timeouts = useRef([]);
    const dragState = useRef(null);

    const [iconHidden, setIconHidden] = useState(initialCollapsed);
    const [isCompact, setIsCompact] = useState(initialCollapsed);
    const [isResizing, setIsResizing] = useState(false);
    const [openWidthPx, setOpenWidthPx] = useState(
        Number.isFinite(Number(initialOpenWidth)) ? Number(initialOpenWidth) : null
    );

    const clearTimers = useCallback(() => {
        timeouts.current.forEach(clearTimeout);
        timeouts.current = [];
    }, []);

    useEffect(() => clearTimers, [clearTimers]);

    useEffect(() => {
        const nextWidth = Number(initialOpenWidth);
        if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
        setOpenWidthPx(nextWidth);
    }, [initialOpenWidth]);

    const isCollapsed = phase === "closed";
    const isAnimating =
        phase === "closing-out" ||
        phase === "closing-shrink" ||
        phase === "opening-grow" ||
        phase === "opening-in";

    const getResizeLimits = useCallback(() => {
        const fallbackClosedPx = lengthToPx(closedWidth, 96);
        const fallbackOpenPx = lengthToPx(openWidth, 320);
        const closedPx = lengthToPx(closedWidth, fallbackClosedPx);
        const minOpenPx = Math.max(lengthToPx(minOpenWidth, 224), closedPx + 24);
        const maxOpenPx = Math.max(lengthToPx(maxOpenWidth, 512), minOpenPx);
        const currentOpenPx = clamp(openWidthPx || fallbackOpenPx, minOpenPx, maxOpenPx);
        const collapsePx = clamp(
            lengthToPx(collapseThreshold, closedPx + ((minOpenPx - closedPx) * 0.5)),
            closedPx + 8,
            minOpenPx - 8
        );
        const expandPx = clamp(
            lengthToPx(expandThreshold, collapsePx + ((minOpenPx - collapsePx) * 0.5)),
            collapsePx + 8,
            minOpenPx
        );

        return {
            closedPx,
            minOpenPx,
            maxOpenPx,
            currentOpenPx,
            collapsePx,
            expandPx,
        };
    }, [closedWidth, collapseThreshold, expandThreshold, maxOpenWidth, minOpenWidth, openWidth, openWidthPx]);

    useEffect(() => {
        if (phase === "open" || phase === "closed") {
            const collapsed = phase === "closed";
            try {
                localStorage.setItem(storageKey, collapsed ? "1" : "0");
            } catch {}
            onCollapsedChange?.(collapsed);
        }
    }, [phase, storageKey, onCollapsedChange]);

    const openWidthCss = openWidthPx ? `${Math.round(openWidthPx)}px` : openWidth;
    const sidebarWidth =
        phase === "closed" || phase === "closing-shrink" ? closedWidth : openWidthCss;

    useEffect(() => {
        const app = document.querySelector(".app-container");
        if (!app) return undefined;

        app.style.setProperty("--app-sidebar-width", sidebarWidth);

        return () => {
            app.style.removeProperty("--app-sidebar-width");
        };
    }, [sidebarWidth]);

    useEffect(() => {
        const app = document.querySelector(".app-container");
        app?.classList.toggle("sidebar-resizing", isResizing);
        document.body.classList.toggle("sidebar-resize-active", isResizing);

        return () => {
            app?.classList.remove("sidebar-resizing");
            document.body.classList.remove("sidebar-resize-active");
        };
    }, [isResizing]);

    const toggle = () => {
        if (isAnimating) return;
        clearTimers();

        if (phase === "open") {
            setIconHidden(true);
            setIsCompact(true);
            setPhase("closed");
        } else {
            setIsCompact(false);
            setIconHidden(false);
            setPhase("open");
        }
    };

    const finishResize = useCallback(() => {
        const state = dragState.current;
        dragState.current = null;
        setIsResizing(false);

        if (state?.lastOpenWidthPx) {
            onOpenWidthChange?.(Math.round(state.lastOpenWidthPx));
        }
    }, [onOpenWidthChange]);

    const updateResize = useCallback((clientX) => {
        const state = dragState.current;
        if (!state) return;

        const nextWidth = clientX;

        if (nextWidth <= state.limits.collapsePx) {
            const shouldStoreMinWidth = !state.startedCollapsed || state.expandedDuringDrag;

            if (shouldStoreMinWidth) {
                state.lastOpenWidthPx = state.limits.minOpenPx;
                setOpenWidthPx(state.limits.minOpenPx);
            }

            setIconHidden(true);
            setIsCompact(true);
            setPhase("closed");
            return;
        }

        if (state.startedCollapsed && nextWidth < state.limits.expandPx) {
            setIconHidden(true);
            setIsCompact(true);
            setPhase("closed");
            return;
        }

        const nextOpenWidth = clamp(nextWidth, state.limits.minOpenPx, state.limits.maxOpenPx);
        state.expandedDuringDrag = true;
        state.lastOpenWidthPx = nextOpenWidth;

        setOpenWidthPx(nextOpenWidth);
        setIconHidden(false);
        setIsCompact(false);
        setPhase("open");
    }, []);

    const startResize = useCallback((event) => {
        if (event.button != null && event.button !== 0) return;

        event.preventDefault();
        event.stopPropagation();
        clearTimers();

        const limits = getResizeLimits();
        const startedCollapsed = phase === "closed" || phase === "closing-shrink";

        dragState.current = {
            limits,
            startedCollapsed,
            expandedDuringDrag: false,
            lastOpenWidthPx: limits.currentOpenPx,
        };

        setIsResizing(true);
        updateResize(event.clientX);

        const onPointerMove = (moveEvent) => {
            moveEvent.preventDefault();
            updateResize(moveEvent.clientX);
        };

        const onPointerUp = () => {
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
            window.removeEventListener("pointercancel", onPointerUp);
            finishResize();
        };

        window.addEventListener("pointermove", onPointerMove, { passive: false });
        window.addEventListener("pointerup", onPointerUp);
        window.addEventListener("pointercancel", onPointerUp);
    }, [clearTimers, finishResize, getResizeLimits, phase, updateResize]);

    const handleResizeKeyDown = useCallback((event) => {
        const limits = getResizeLimits();
        const step = event.shiftKey ? 32 : 16;
        const currentOpenWidth = clamp(openWidthPx || limits.currentOpenPx, limits.minOpenPx, limits.maxOpenPx);

        if (event.key === "ArrowRight") {
            event.preventDefault();
            const nextWidth = isCollapsed ? limits.minOpenPx : clamp(currentOpenWidth + step, limits.minOpenPx, limits.maxOpenPx);
            clearTimers();
            setOpenWidthPx(nextWidth);
            setIconHidden(false);
            setIsCompact(false);
            setPhase("open");
            onOpenWidthChange?.(Math.round(nextWidth));
        }

        if (event.key === "ArrowLeft") {
            event.preventDefault();
            clearTimers();

            if (!isCollapsed && currentOpenWidth <= limits.minOpenPx + 1) {
                setIconHidden(true);
                setIsCompact(true);
                setPhase("closed");
                return;
            }

            const nextWidth = clamp(currentOpenWidth - step, limits.minOpenPx, limits.maxOpenPx);
            setOpenWidthPx(nextWidth);
            setPhase("open");
            onOpenWidthChange?.(Math.round(nextWidth));
        }

        if (event.key === "Home") {
            event.preventDefault();
            clearTimers();
            setIconHidden(true);
            setIsCompact(true);
            setPhase("closed");
        }

        if (event.key === "End") {
            event.preventDefault();
            clearTimers();
            setOpenWidthPx(limits.maxOpenPx);
            setIconHidden(false);
            setIsCompact(false);
            setPhase("open");
            onOpenWidthChange?.(Math.round(limits.maxOpenPx));
        }
    }, [clearTimers, getResizeLimits, isCollapsed, onOpenWidthChange, openWidthPx]);

    const sidebarStyle = {
        width: sidebarWidth,
        transition: "none",
    };

    const navStyle = {
        left: sidebarWidth,
        right: 0,
        transition: "none",
    };

    const mainStyle = {
        marginLeft: sidebarWidth,
        transition: "none",
    };

    const iconShouldBeOpaque =
        phase === "open" || phase === "opening-in";

    const iconStyle = {
        opacity: iconShouldBeOpaque ? 1 : 0,
        transition: "none",
        pointerEvents: iconHidden ? "none" : undefined,
    };

    const visualCollapsed =
        phase === "closing-out"   ||
        phase === "closing-shrink"||
        phase === "closed"        ||
        phase === "opening-grow";

    const resizeLimits = getResizeLimits();
    const resizeValueNow = phase === "closed"
        ? resizeLimits.closedPx
        : openWidthPx || resizeLimits.currentOpenPx;

    return {
        phase,
        isCollapsed,
        isAnimating,
        isResizing,
        toggle,
        sidebarStyle,
        navStyle,
        mainStyle,
        iconStyle,
        iconHidden,
        isCompact,
        visualCollapsed,
        resizeHandleProps: {
            role: "separator",
            "aria-orientation": "vertical",
            "aria-label": "Resize sidebar",
            "aria-valuemin": Math.round(resizeLimits.closedPx),
            "aria-valuemax": Math.round(resizeLimits.maxOpenPx),
            "aria-valuenow": Math.round(resizeValueNow),
            "aria-valuetext": phase === "closed" ? "Collapsed" : `${Math.round(resizeValueNow)} pixels`,
            tabIndex: 0,
            title: "Drag to resize sidebar",
            onPointerDown: startResize,
            onKeyDown: handleResizeKeyDown,
        },
    };
}
