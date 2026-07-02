import tinycolor from 'tinycolor2';

const DEFAULT_TRIPLET = '121, 159, 236';

function normalizeTriplet(value) {
    const match = String(value || '').trim().match(/^(\d+)\s*,\s*(\d+)\s*,\s*(\d+)$/);
    return match ? `${match[1]}, ${match[2]}, ${match[3]}` : null;
}

function toTinyColor(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    const triplet = normalizeTriplet(raw);
    const color = tinycolor(triplet ? `rgb(${triplet})` : raw);
    return color.isValid() ? color : null;
}

function toTriplet(value, fallback = DEFAULT_TRIPLET) {
    const triplet = normalizeTriplet(value);
    if (triplet) return triplet;

    const color = toTinyColor(value);
    if (!color) return fallback;

    const { r, g, b } = color.toRgb();
    return `${r}, ${g}, ${b}`;
}

export function toCssColor(value, fallback = `rgb(${DEFAULT_TRIPLET})`) {
    const raw = String(value || '').trim();
    if (!raw) return fallback;

    const triplet = normalizeTriplet(raw);
    if (triplet) return `rgb(${triplet})`;

    const color = toTinyColor(raw);
    return color ? color.toHexString() : fallback;
}

function paletteColor(palette, key) {
    return palette?.source === 'image' ? palette[key] : null;
}

export function getBudgetTheme(budget, palette = null) {
    const accentSource = paletteColor(palette, 'Vibrant') || budget?.bannerColorVibrant || budget?.bannerColor;
    const accentStrongSource = paletteColor(palette, 'LightVibrant') || budget?.bannerColorLightVibrant || budget?.bannerColorVibrant;
    const accentMutedSource = paletteColor(palette, 'Muted') || budget?.bannerColorMuted || budget?.bannerColor;
    const accentDarkSource = paletteColor(palette, 'DarkVibrant') || budget?.bannerColorDarkVibrant || budget?.bannerColorDarkMuted;
    const accentDarkMutedSource = paletteColor(palette, 'DarkMuted') || budget?.bannerColorDarkMuted || budget?.bannerColorMuted;
    const accentLightSource = paletteColor(palette, 'LightMuted') || paletteColor(palette, 'LightVibrant') || budget?.bannerColorLightVibrant || budget?.bannerColorLightMuted;

    const accentTriplet = toTriplet(accentSource, DEFAULT_TRIPLET);
    const accent = toCssColor(accentSource);
    const accentStrong = toCssColor(accentStrongSource, accent);
    const accentMuted = toCssColor(accentMutedSource, accent);
    const accentDark = toCssColor(accentDarkSource, accent);
    const accentDarkMuted = toCssColor(accentDarkMutedSource, accentDark);
    const accentLight = toCssColor(accentLightSource, accentStrong);
    const hasLivePalette = palette?.source === 'image';

    const style = {
        '--app-theme-accent': accent,
        '--app-theme-accent-strong': accentStrong,
        '--app-theme-accent-muted': accentMuted,
        '--app-theme-accent-dark': accentDark,
        '--app-theme-accent-dark-muted': accentDarkMuted,
        '--app-theme-accent-light': accentLight,
        '--app-theme-accent-text': '#fff',
        '--app-theme-soft': `color-mix(in srgb, ${accent} 16%, transparent)`,
        '--app-theme-softer': `color-mix(in srgb, ${accent} 8%, transparent)`,
        '--app-theme-border': `color-mix(in srgb, ${accent} 42%, transparent)`,
        '--app-theme-border-strong': `color-mix(in srgb, ${accent} 68%, transparent)`,
        '--app-theme-glow': `color-mix(in srgb, ${accent} 24%, transparent)`,
        '--app-theme-focus': `2px color-mix(in srgb, ${accent} 30%, transparent)`,
        '--budget-theme-accent': accent,
        '--budget-theme-accent-rgb': accentTriplet,
        '--budget-theme-accent-strong': accentStrong,
        '--budget-theme-accent-muted': accentMuted,
        '--budget-theme-accent-dark': accentDark,
        '--budget-theme-accent-dark-muted': accentDarkMuted,
        '--budget-theme-accent-light': accentLight,
        '--analytics-accent': accent,
        '--analytics-accent-strong': accentStrong,
        '--analytics-accent-muted': accentMuted,
        '--analytics-accent-dark': accentDark,
        '--analytics-accent-dark-muted': accentDarkMuted,
        '--analytics-accent-light': accentLight,
        '--analytics-accent-text': '#fff',
        '--analytics-accent-soft': `color-mix(in srgb, ${accent} 16%, transparent)`,
        '--analytics-accent-softer': `color-mix(in srgb, ${accent} 8%, transparent)`,
        '--analytics-accent-border': `color-mix(in srgb, ${accent} 42%, transparent)`,
        '--analytics-accent-glow': `color-mix(in srgb, ${accent} 24%, transparent)`,
        '--studio-accent': accent,
        '--studio-accent-strong': accentStrong,
        '--studio-accent-muted': accentMuted,
        '--studio-accent-dark': accentDark,
        '--studio-accent-dark-muted': accentDarkMuted,
        '--studio-accent-light': accentLight,
        '--color': accentTriplet,
    };

    return {
        hasTheme: Boolean(hasLivePalette || budget?.bannerColor || budget?.bannerColorVibrant),
        style,
        colors: {
            accent,
            accentStrong,
            accentMuted,
            accentDark,
            accentDarkMuted,
            accentLight,
            green: '#7ddc8a',
            red: '#f87171',
            gray: '#9ca3af',
        },
    };
}
