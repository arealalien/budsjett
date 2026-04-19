import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

function SparkleSvg({ className = "" }) {
    return (
        <svg aria-label="Sparkle" className={className} fill="currentColor" role="img" viewBox="0 0 24 24">
            <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
        </svg>
    );
}

function makeStar(id) {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const size = 7 + Math.random() * 3;
    const dur = 0.9 + Math.random() * 1.1;
    const rot = Math.random() * 50;
    const alpha = 0.55 + Math.random() * 0.35;

    const lifeMs = 1200 + Math.random() * 1200;
    const fadeMs = 250 + Math.random() * 200;

    return { id, x, y, size, dur, rot, alpha, lifeMs, fadeMs, phase: "alive" };
}

function seedStars(count = 6) {
    return Array.from({ length: count }, (_, i) =>
        makeStar(`s-${i}-${Math.random().toString(16).slice(2)}`)
    );
}

function makeBurstParticle(id, originX, originY) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * 44;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;

    const size = 15 + Math.random() * 5;
    const rot = -180 + Math.random() * 360;
    const dur = 420 + Math.random() * 220;
    const alpha = 0.55 + Math.random() * 0.45;

    return { id, originX, originY, dx, dy, size, rot, dur, alpha };
}

function renderLetters(text) {
    return text
        .toString()
        .split("")
        .map((char, i) => <span key={i}>{char === " " ? "\u00A0" : char}</span>);
}

export default function Button({
                                   text,
                                   textEffect = "none", // "none" | "letters"
                                   textReverse = false,
                                   icon,
                                   iconPosition = "right",
                                   effects = "default", // "default" | "magic" | "none"
                                   variant = "primary",
                                   onClick,
                                   className = "",
                                   disabled,
                                   type = "button",
                                   ...props
                               }) {
    const buttonRef = useRef(null);
    const [isHovering, setIsHovering] = useState(false);

    const effectsEnabled = effects !== "none";
    const isMagic = effects === "magic" || variant === "magic";
    const STAR_COUNT = 7;

    const [stars, setStars] = useState(() => (isMagic ? seedStars(STAR_COUNT) : []));

    // burst state
    const [burst, setBurst] = useState([]);

    const isLetterText = textEffect === "letters";

    useEffect(() => {
        if (!isMagic) {
            setStars([]);
            return;
        }
        setStars((prev) => (prev.length ? prev : seedStars(STAR_COUNT)));
    }, [isMagic]);

    useEffect(() => {
        if (!isMagic || !isHovering) return;

        const tickMs = 450;
        const id = setInterval(() => {
            setStars((prev) => {
                if (!prev.length) return seedStars(STAR_COUNT);

                const next = prev.map((s) => ({ ...s }));
                const replaceCount = 2;

                for (let r = 0; r < replaceCount; r++) {
                    const idx = Math.floor(Math.random() * next.length);
                    if (next[idx].phase === "alive") next[idx].phase = "dying";
                }

                return next;
            });
        }, tickMs);

        return () => clearInterval(id);
    }, [isMagic, isHovering]);


    const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

    const handleStarAnimEnd = (id) => {
        setStars((prev) =>
            prev.map((s) =>
                s.id === id && s.phase === "dying"
                    ? makeStar(`s-${Date.now()}-${Math.random().toString(16).slice(2)}`)
                    : s
            )
        );
    };

    const applyTransform = ({ rotateX = 0, rotateY = 0, scale = 1, translateY = 0 }) => {
        if (!effectsEnabled) return;
        const button = buttonRef.current;
        if (!button) return;

        button.style.transform = `
      perspective(600px)
      translateY(${translateY}px)
      scale(${scale})
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
    `;
    };

    const handleMouseEnter = () => {
        if (!effectsEnabled) return;
        setIsHovering(true);
        applyTransform({ translateY: -2 });
        if (isMagic) setStars(seedStars(STAR_COUNT));
    };

    const handleMouseLeave = () => {
        if (!effectsEnabled) return;
        setIsHovering(false);
        applyTransform({});
    };

    const handleMouseDown = (e) => {
        if (!effectsEnabled) return;
        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const offsetX = (e.clientX - centerX) / rect.width;
        const offsetY = (e.clientY - centerY) / rect.height;

        applyTransform({
            rotateY: offsetX * 14,
            rotateX: offsetY * -16,
            scale: 0.96,
            translateY: 1,
        });
    };

    const handleMouseUp = () => {
        if (!effectsEnabled) return;
        applyTransform(isHovering ? { translateY: -2 } : {});
    };

    // --- click burst ---
    const triggerBurst = (e) => {
        const el = buttonRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();

        const originX = clamp(e.clientX, rect.left + 6, rect.right - 6);
        const originY = clamp(e.clientY, rect.top + 6, rect.bottom - 6);

        const jitter = 6;
        const ox = originX + (Math.random() * 2 - 1) * jitter;
        const oy = originY + (Math.random() * 2 - 1) * jitter;

        const count = 14;
        const now = Date.now();

        const particles = Array.from({ length: count }, (_, i) =>
            makeBurstParticle(`b-${now}-${i}-${Math.random().toString(16).slice(2)}`, ox, oy)
        );

        setBurst((prev) => [...prev, ...particles]);
    };

    const handleClick = (e) => {
        if (effectsEnabled && isMagic && !disabled) triggerBurst(e);
        onClick?.(e);
    };

    const removeBurst = (id) => {
        setBurst((prev) => prev.filter((p) => p.id !== id));
    };

    return (
        <>
            {/* burst portal (so it won't be clipped by overflow:hidden) */}
            {burst.length > 0 &&
                createPortal(
                    <div className="button-burst-root" aria-hidden="true">
                        {burst.map((p) => (
                            <span
                                key={p.id}
                                className="button-burst-star"
                                onAnimationEnd={() => removeBurst(p.id)}
                                style={{
                                    left: `${p.originX}px`,
                                    top: `${p.originY}px`,
                                    width: `${p.size}px`,
                                    height: `${p.size}px`,
                                    ["--dx"]: `${p.dx}px`,
                                    ["--dy"]: `${p.dy}px`,
                                    ["--rot"]: `${p.rot}deg`,
                                    ["--dur"]: `${p.dur}ms`,
                                    ["--alpha"]: p.alpha,
                                }}
                            >
                <SparkleSvg className="button-star-svg" />
              </span>
                        ))}
                    </div>,
                    document.body
                )}

            <button
                ref={buttonRef}
                className={[
                    "button",
                    `button-${variant}`,
                    isMagic ? "magic" : "",
                    effects === "none" ? "no-effects" : "",
                    isLetterText ? "button-letters" : "",
                    textReverse ? "reverse" : "",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
                onClick={handleClick}
                onMouseEnter={effectsEnabled ? handleMouseEnter : undefined}
                onMouseLeave={effectsEnabled ? handleMouseLeave : undefined}
                onMouseDown={effectsEnabled ? handleMouseDown : undefined}
                onMouseUp={effectsEnabled ? handleMouseUp : undefined}
                disabled={disabled}
                type={type}
                style={{ transformStyle: effectsEnabled ? "preserve-3d" : undefined }}
                {...props}
            >
                {isMagic && (
                    <>
                        <div className="spark"></div>
                        <div className="spark-backdrop"></div>

                        <span className={`button-magic-layer ${isHovering ? "is-on" : ""}`} aria-hidden="true">
              {stars.map((s) => (
                  <span
                      key={s.id}
                      className={`button-star ${s.phase === "dying" ? "is-dying" : ""}`}
                      onAnimationEnd={(e) => {
                          if (e.animationName === "buttonStarFade") handleStarAnimEnd(s.id);
                      }}
                      style={{
                          left: `${s.x}%`,
                          top: `${s.y}%`,
                          width: `${s.size}px`,
                          height: `${s.size}px`,
                          ["--dur"]: `${s.dur}s`,
                          ["--rot"]: `${s.rot}deg`,
                          ["--alpha"]: s.alpha,
                          ["--fade"]: `${s.fadeMs}ms`,
                      }}
                  >
                  <SparkleSvg className="button-star-svg" />
                </span>
              ))}
            </span>
                    </>
                )}

                <span className="button-content">
                    {icon && iconPosition === "left" && <span className="material-symbols-rounded button-icon">{icon}</span>}
                    {isLetterText ? (
                        <span className="button-text button-text-letters" aria-label={text}>
                          {renderLetters(text)}
                        </span>
                    ) : (
                        <span className="button-text">{text}</span>
                    )}
                    {icon && iconPosition === "right" && <span className="material-symbols-rounded button-icon">{icon}</span>}
                </span>

                {effectsEnabled && <div className="button-glow" />}
            </button>
        </>
    );
}
