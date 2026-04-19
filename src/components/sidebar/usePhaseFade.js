import { useEffect, useRef, useState } from "react";
import { useAnimationMode } from "./AnimationMode";

export default function usePhaseFade(
    phase,
    {
        outMs = 280,
        inMs = 280,
        easing = "cubic-bezier(.175, .685, .32, 1)",
        delay = 0,
        initiallyHidden = false,
    } = {}
) {
    const { isStatic } = useAnimationMode();
    const [hidden, setHidden] = useState(initiallyHidden || phase === "closed");
    const timer = useRef();

    useEffect(() => () => clearTimeout(timer.current), []);

    useEffect(() => {
        clearTimeout(timer.current);

        if (isStatic) {
            setHidden(phase === "closed" || phase === "closing-out" || phase === "opening-grow");
            return;
        }

        if (phase === "closing-out") {
            timer.current = setTimeout(() => setHidden(true), outMs + delay);
        } else if (phase === "opening-grow") {
            setHidden(false);
        } else if (phase === "closed") {
            setHidden(true);
        } else if (phase === "open") {
            setHidden(false);
        }
    }, [phase, outMs, delay, isStatic]);


    const isOpaque = phase === "open" || phase === "opening-in";
    const isFadingOut = phase === "closing-out";
    const isFadingIn = phase === "opening-in";

    const style = {
        opacity: isOpaque ? 1 : 0,
        transition: isStatic
            ? "none"
            : isFadingOut
                ? `opacity ${outMs}ms ${easing} ${delay}ms`
                : isFadingIn
                    ? `opacity ${inMs}ms ${easing} ${delay}ms`
                    : "none",
        pointerEvents: hidden ? "none" : undefined,
    };

    return { style, hidden };
}
