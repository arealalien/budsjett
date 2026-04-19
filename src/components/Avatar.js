import React, { useEffect, useMemo, useState } from 'react';

function initialsOf(user) {
    const source = user?.displayName || user?.username || '?';
    return source.trim().charAt(0).toUpperCase();
}

function makeSquirclePolygon(n = 5, steps = 80) {
    const pts = [];

    for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const cx = Math.cos(t);
        const sy = Math.sin(t);

        const x = Math.sign(cx) * Math.pow(Math.abs(cx), 2 / n);
        const y = Math.sign(sy) * Math.pow(Math.abs(sy), 2 / n);

        pts.push(`${50 + x * 50}% ${50 + y * 50}%`);
    }

    return `polygon(${pts.join(',')})`;
}

export default function Avatar({
                                   user,
                                   src,
                                   alt,
                                   size = '2.75rem',
                                   className = '',
                                   version,
                                   n = 5,
                                   steps = 80,
                                   fallbackSrc = '/images/avatar-placeholder.webp',
                               }) {
    const [imgError, setImgError] = useState(false);
    const [fallbackImgError, setFallbackImgError] = useState(false);

    const fallbackLetter = useMemo(() => initialsOf(user), [user]);
    const clip = useMemo(() => makeSquirclePolygon(n, steps), [n, steps]);

    const imageSrc = useMemo(() => {
        const raw = src || user?.avatarUrl;
        if (!raw || imgError) return null;

        if (!version) return raw;

        const separator = raw.includes('?') ? '&' : '?';
        return `${raw}${separator}v=${encodeURIComponent(version)}`;
    }, [src, user?.avatarUrl, imgError, version]);

    useEffect(() => {
        setImgError(false);
        setFallbackImgError(false);
    }, [src, user?.avatarUrl, version]);

    return (
        <div
            className={`avatar ${className}`}
            style={{
                '--avatar-size': size,
                '--avatar-clip': clip,
            }}
            aria-label={alt || user?.displayName || user?.username || 'User avatar'}
        >
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt={alt || user?.displayName || user?.username || 'User avatar'}
                    className="avatar-image"
                    onError={() => setImgError(true)}
                />
            ) : fallbackSrc && !fallbackImgError ? (
                <img
                    src={fallbackSrc}
                    alt=""
                    aria-hidden="true"
                    className="avatar-image avatar-image-fallback"
                    onError={() => setFallbackImgError(true)}
                />
            ) : (
                <div className="avatar-fallback" aria-hidden="true">
                    {fallbackLetter}
                </div>
            )}
        </div>
    );
}