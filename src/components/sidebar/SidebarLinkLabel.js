import React from "react";
import usePhaseFade from "./usePhaseFade";

export default function SidebarLinkLabel({
                                             phase,
                                             children,
                                             className = "",
                                             delay = 0,
                                             outMs = 280,
                                             inMs = 280,
                                             easing = "cubic-bezier(.175, .685, .32, 1)",
                                             initiallyHidden = phase === "closed",
                                             animated,
                                         }) {
    const { style, hidden } = usePhaseFade(phase, {
        outMs,
        inMs,
        easing,
        delay,
        initiallyHidden,
        animated,
    });

    return (
        <span
            className={className}
            style={{ ...style, display: hidden ? "none" : undefined }}
        >
      {children}
    </span>
    );
}
