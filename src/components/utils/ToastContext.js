// ToastContext.jsx
import React, { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext();

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);

    const showToast = useCallback((message, opts = {}) => {
        const { type = "info", duration = 3000 } = opts;
        const id = Date.now();
        setToast({ id, message, type });
        setTimeout(() => setToast(null), duration);
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && <Toast key={toast.id} message={toast.message} type={toast.type} />}
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}

function Toast({ message, type = "info" }) {
    return (
        <div className={`toast toast-${type}`} role="status" aria-live="polite">
            <p className="toast-message">{message}</p>
        </div>
    );
}