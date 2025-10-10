import React from "react";

export default function AnimatedButton({ children, onClick, className = "", disabled, type, ...props }) {
    const renderLetters = (text) => {
        return text
            .toString()
            .split("")
            .map((char, i) => (
                <span key={i}>
          {char === " " ? "\u00A0" : char}
        </span>
            ));
    };

    return (
        <button
            className={`button-animated ${className}`}
            onClick={onClick}
            disabled={disabled}
            type={type}
            {...props}
        >
            <div>{renderLetters(children)}</div>
        </button>
    );
}