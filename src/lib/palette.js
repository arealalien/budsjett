import { Vibrant } from 'node-vibrant/browser';

export async function extractPaletteFromBlob(blob) {
    const objectUrl = URL.createObjectURL(blob);

    try {
        const palette = await Vibrant.from(objectUrl).getPalette();

        const toTriplet = (swatch) => {
            if (!swatch?.rgb) return null;
            const [r, g, b] = swatch.rgb.map((v) => Math.round(v));
            return `${r}, ${g}, ${b}`;
        };

        return {
            Vibrant: toTriplet(palette.Vibrant),
            DarkVibrant: toTriplet(palette.DarkVibrant),
            LightVibrant: toTriplet(palette.LightVibrant),
            Muted: toTriplet(palette.Muted),
            DarkMuted: toTriplet(palette.DarkMuted),
            LightMuted: toTriplet(palette.LightMuted),
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

export function pickBannerColor(swatches) {
    return (
        swatches?.DarkMuted ||
        swatches?.Muted ||
        swatches?.DarkVibrant ||
        swatches?.Vibrant ||
        '68, 68, 68'
    );
}