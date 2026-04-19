import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { useAnimationMode } from "./AnimationMode";

function SidebarMenuTitle({
                              text,
                              keep = 3,
                              phase,
                              className = "",
                              stepMs = 16,
                              outMs = 280,
                              inMs = 280,
                              easing = "cubic-bezier(.175,.685,.32,1)",
                              animated,
                          }) {
    const { isStatic } = useAnimationMode(animated);

    const chars = useMemo(() => Array.from(text ?? ""), [text]);
    const safeKeep = Math.max(0, Math.min(keep, chars.length));
    const totalHidden = Math.max(0, chars.length - safeKeep);

    const [tailHidden, setTailHidden] = useState(
        phase === "closed" || phase === "closing-shrink" || phase === "opening-grow"
    );

    const [enteringIn, setEnteringIn] = useState(false);

    const timers = useRef([]);
    useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

    useEffect(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];

        if (isStatic) {
            const collapsedLike =
                phase === "closing-out" ||
                phase === "closing-shrink" ||
                phase === "closed" ||
                phase === "opening-grow";
            setTailHidden(collapsedLike);
            setEnteringIn(false);
            return;
        }

        if (phase === "closing-out") {
            setTailHidden(false);
            setEnteringIn(false);
            const lastDelay = totalHidden > 0 ? (totalHidden - 1) * stepMs : 0;
            timers.current.push(
                setTimeout(() => setTailHidden(true), outMs + lastDelay)
            );
        } else if (phase === "opening-grow") {
            setTailHidden(true);
            setEnteringIn(false);
        } else if (phase === "opening-in") {
            setTailHidden(false);
            setEnteringIn(true);
            const id = requestAnimationFrame(() => setEnteringIn(false));
            timers.current.push(() => cancelAnimationFrame(id));
        } else if (phase === "closed") {
            setTailHidden(true);
            setEnteringIn(false);
        } else if (phase === "open") {
            setTailHidden(false);
            setEnteringIn(false);
        }
    }, [phase, isStatic, outMs, stepMs, totalHidden]);

    const collapsedVisual =
        phase === "closing-out" ||
        phase === "closing-shrink" ||
        phase === "closed" ||
        phase === "opening-grow" ||
        (phase === "opening-in" && enteringIn);

    const shouldAnimate = !isStatic && (phase === "closing-out" || phase === "opening-in");
    const durMs = phase === "closing-out" ? outMs : inMs;

    return (
        <h3
            className={`sidebar-menu-title ${collapsedVisual ? "is-collapsed" : ""} ${className}`}
            aria-label={text}
        >
      <span
          className="smt-row"
          aria-hidden="true"
          style={{ display: "inline-block", position: "relative", overflow: "hidden" }}
      >
        {chars.map((ch, i) => {
            const isTail = i >= safeKeep;
            const hiddenIndex = isTail ? i - safeKeep : 0;

            let delayMs = 0;
            if (!isStatic && isTail) {
                if (phase === "closing-out") {
                    delayMs = (totalHidden - 1 - hiddenIndex) * stepMs;
                } else if (phase === "opening-in") {
                    delayMs = hiddenIndex * stepMs;
                }
            }

            const style = {
                transition: shouldAnimate
                    ? `transform ${durMs}ms ${easing} ${delayMs}ms, opacity ${durMs}ms ${easing} ${delayMs}ms`
                    : "none",
                transform: collapsedVisual && isTail ? "translateY(100%)" : "translateY(0)",
                opacity: collapsedVisual && isTail ? 0 : 1,
                display: tailHidden && isTail ? "none" : undefined,
            };

            return (
                <span key={`${ch}-${i}`} className="smt-char" style={style}>
                    {ch === " " ? "\u00A0" : ch}
                </span>
            );
        })}
      </span>
        </h3>
    );
}

export default memo(SidebarMenuTitle);
