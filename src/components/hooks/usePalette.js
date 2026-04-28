import { useState, useEffect } from 'react';
import { Vibrant } from 'node-vibrant/browser';
import tinycolor from 'tinycolor2';

export default function usePalette(imageUrl) {
    const [swatches, setSwatches] = useState({
        Vibrant:      '#444',
        DarkVibrant:  '#444',
        LightVibrant: '#444',
        Muted:        '#444',
        DarkMuted:    '#444',
        LightMuted:   '#444',
    });

    useEffect(() => {
        if (!imageUrl) return;
        Vibrant.from(imageUrl, { crossOrigin: 'anonymous' })
            .getPalette()
            .then(palette => {
                const results = {};
                [ 'Vibrant', 'DarkVibrant', 'LightVibrant',
                    'Muted',   'DarkMuted',   'LightMuted' ].forEach(key => {
                    const sw = palette[key];
                    if (sw && sw.rgb) {
                        results[key] = tinycolor({
                            r: sw.rgb[0],
                            g: sw.rgb[1],
                            b: sw.rgb[2]
                        }).toHexString();
                    } else {
                        results[key] = '#444';
                    }
                });
                setSwatches(results);
            })
            .catch(console.error);
    }, [imageUrl]);

    return swatches;
}