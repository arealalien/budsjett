import React, { createContext, useContext } from "react";

// "fluid" = animations on (default)
// "static" = no animations
// "system" = follow prefers-reduced-motion
const AnimationModeContext = createContext("fluid");

export function AnimationProvider({ animated = "fluid", children }) {
    return (
        <AnimationModeContext.Provider value={animated}>
            {children}
        </AnimationModeContext.Provider>
    );
}

/** Read current mode and a computed `isStatic` boolean */
export function useAnimationMode(override) {
    const ctx = useContext(AnimationModeContext);
    const mode = override != null ? override : ctx;

    let prefersReduce = false;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
        try {
            prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        } catch {}
    }

    const isStatic = mode === "static" || (mode === "system" && prefersReduce);
    return { mode, isStatic };
}