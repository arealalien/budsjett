import React from "react";
import usePhaseFade from "./usePhaseFade";

export default function PhaseFade({
                                      as: Tag = "div",
                                      phase,
                                      children,
                                      className = "",
                                      style = {},
                                      delay = 0,
                                      outMs = 280,
                                      inMs = 280,
                                      easing = "cubic-bezier(.175, .685, .32, 1)",
                                      animated,
                                  }) {
    const { style: fadeStyle, hidden } = usePhaseFade(phase, {
        outMs, inMs, easing, delay,
        initiallyHidden: phase === "closed",
        animated,
    });

    return (
        <Tag
            className={className}
            style={{ ...style, ...fadeStyle, display: hidden ? "none" : undefined }}
            aria-hidden={hidden ? "true" : undefined}
        >
            {children}
        </Tag>
    );
}
