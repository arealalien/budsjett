import React, { useRef, useState } from "react";

export default function Dropdown({
                                     children,
                                     className = "",
                                     disabled = false,
                                     leftIcon = null,
                                     rightIcon = null,
                                     ...props
                                 }) {
    const [isOpen, setIsOpen] = useState(false);
    const openedByPointerRef = useRef(false);

    return (
        <div
            className={`dropdown ${disabled ? "is-disabled" : ""} ${className}`}
        >
            {leftIcon && (
                <span
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        left: 10,
                        display: "inline-flex",
                        pointerEvents: "none",
                        opacity: 0.9,
                    }}
                >
          {leftIcon}
        </span>
            )}

            <select
                disabled={disabled}
                {...props}
                onMouseDown={() => {
                    openedByPointerRef.current = true;
                    setIsOpen(true);
                }}
                onFocus={() => {
                    if (!openedByPointerRef.current) setIsOpen(true);
                }}
                onBlur={() => {
                    openedByPointerRef.current = false;
                    setIsOpen(false);
                }}
                style={{
                    color: "inherit",
                    cursor: disabled ? "not-allowed" : "pointer",
                }}
                className={leftIcon ? "icon" : ""}
            >
                {children}
            </select>

            <span
                aria-hidden="true"
                style={{
                    position: "absolute",
                    right: 10,
                    transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    paddingTop: isOpen ? ".2em" : "0",
                }}
            >
        {rightIcon ?? (
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>
                expand_more
            </span>
        )}
      </span>
        </div>
    );
}
