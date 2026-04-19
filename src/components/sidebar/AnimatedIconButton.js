import React from "react";
import useHoverOscillation from "./useHoverOscillation";
import usePhaseFade from "./usePhaseFade";
import { Outlet, NavLink, useNavigate } from 'react-router-dom';

export function AnimatedIconButton({
                                       mode = "rotate",
                                       amplitude,
                                       speed,
                                       className = "",
                                       ariaLabel,
                                       children,
                                       phase,
                                       delay = 0,
                                       outMs = 280,
                                       inMs = 280,
                                       easing = "cubic-bezier(.175, .685, .32, 1)",
                                       animated,
                                       path,
                                       ...rest
                                   }) {
    const { style: hoverStyle, handlers } = useHoverOscillation({
        mode,
        amplitude,
        speed,
    });

    const effectivePhase = phase ?? "open";

    const { style: fadeStyle, hidden } = usePhaseFade(effectivePhase, {
        outMs,
        inMs,
        easing,
        delay,
        initiallyHidden: false,
        animated,
    });

    const Wrapper = path ? NavLink : "button";
    const wrapperProps = path ? { to: path } : { type: "button" };

    return (
        <Wrapper
            {...wrapperProps}
            aria-label={ariaLabel}
            className={`sidebar-bottom-shortcuts-button ${className}`}
            style={{
                ...hoverStyle,
                ...fadeStyle,
                display: hidden ? "none" : undefined,
                pointerEvents: hidden ? "none" : undefined,
            }}
            {...handlers}
            tabIndex={hidden ? -1 : 0}
            aria-hidden={hidden ? "true" : undefined}
            {...rest}
        >
            {children}
        </Wrapper>
    );
}

export function SbsNotificationButton(props) {
    const { phase: _ignored, ...rest } = props;
    return (
        <AnimatedIconButton
            mode="rotate"
            amplitude={22}
            speed={0.83}
            className="sbs-notification"
            ariaLabel="Notifications"
            {...rest}
        />
    );
}

export function SbsUploadButton(props) {
    return (
        <AnimatedIconButton
            mode="scale"
            amplitude={0.10}
            speed={0.71}
            className="sbs-upload secondary-buttons"
            ariaLabel="Upload"
            {...props}
        />
    );
}

export function SbsGraphButton(props) {
    return (
        <AnimatedIconButton
            mode="scale"
            amplitude={0.10}
            speed={0.71}
            className="sbs-graph secondary-buttons"
            ariaLabel="Analytics"
            {...props}
        />
    );
}

export function SbsCogButton(props) {
    return (
        <AnimatedIconButton
            mode="rotate"
            amplitude={22}
            speed={0.56}
            className="sbs-cog secondary-buttons"
            ariaLabel="Settings"
            {...props}
        />
    );
}
