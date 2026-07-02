import { useState, useEffect } from 'react';
import { Vibrant } from 'node-vibrant/browser';
import tinycolor from 'tinycolor2';

const SWATCH_KEYS = [
    'Vibrant',
    'DarkVibrant',
    'LightVibrant',
    'Muted',
    'DarkMuted',
    'LightMuted',
];

const DEFAULT_SWATCHES = {
    Vibrant: '#444',
    DarkVibrant: '#444',
    LightVibrant: '#444',
    Muted: '#444',
    DarkMuted: '#444',
    LightMuted: '#444',
};

const FALLBACK_CHART_COLORS = [
    '#7a9fec',
    '#5eead4',
    '#7ddc8a',
    '#f4bd61',
    '#a78bfa',
    '#f87171',
    '#9ca3af',
];

function normalizeColor(value, fallback = '#444') {
    const color = tinycolor(value);
    return color.isValid() ? color.toHexString() : fallback;
}

function swatchToHex(swatch, fallback = '#444') {
    if (swatch?.rgb) {
        const [r, g, b] = swatch.rgb;
        return tinycolor({ r, g, b }).toHexString();
    }

    return normalizeColor(swatch?.hex, fallback);
}

function uniqueColors(colors) {
    const seen = new Set();

    return colors
        .map((color) => normalizeColor(color, null))
        .filter(Boolean)
        .filter((color) => {
            if (seen.has(color)) return false;
            seen.add(color);
            return true;
        });
}

export function buildPalette(swatches = DEFAULT_SWATCHES, meta = {}) {
    const normalized = SWATCH_KEYS.reduce((result, key) => {
        result[key] = normalizeColor(swatches[key], DEFAULT_SWATCHES[key]);
        return result;
    }, {});

    const chartPalette = uniqueColors([
        normalized.Vibrant,
        tinycolor(normalized.LightVibrant).saturate(8).toHexString(),
        tinycolor(normalized.Muted).spin(-26).saturate(14).lighten(4).toHexString(),
        tinycolor(normalized.DarkVibrant).spin(36).saturate(10).lighten(8).toHexString(),
        tinycolor(normalized.LightMuted).spin(-44).saturate(12).darken(5).toHexString(),
        tinycolor(normalized.DarkMuted).spin(58).saturate(12).lighten(12).toHexString(),
        ...FALLBACK_CHART_COLORS,
    ]);

    return {
        ...normalized,
        chartPalette,
        source: meta.source || 'default',
        isReady: Boolean(meta.isReady),
    };
}

const DEFAULT_PALETTE = buildPalette(DEFAULT_SWATCHES);

export default function usePalette(imageUrl) {
    const [swatches, setSwatches] = useState(DEFAULT_PALETTE);

    useEffect(() => {
        let active = true;

        if (!imageUrl) {
            setSwatches(DEFAULT_PALETTE);
            return () => {
                active = false;
            };
        }

        Vibrant.from(imageUrl, { crossOrigin: 'anonymous' })
            .getPalette()
            .then(palette => {
                const results = {};
                SWATCH_KEYS.forEach(key => {
                    results[key] = swatchToHex(palette[key], DEFAULT_SWATCHES[key]);
                });

                if (active) {
                    setSwatches(buildPalette(results, { source: 'image', isReady: true }));
                }
            })
            .catch((error) => {
                if (active) {
                    console.error(error);
                    setSwatches(buildPalette(DEFAULT_SWATCHES, { source: 'error' }));
                }
            });

        return () => {
            active = false;
        };
    }, [imageUrl]);

    return swatches;
}
