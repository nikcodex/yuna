export class FilterEngine {
    static presets = {
        pop: { bands: [{ band: 0, gain: -0.25 }, { band: 1, gain: 0.48 }, { band: 2, gain: 0.59 }, { band: 3, gain: 0.72 }, { band: 4, gain: 0.56 }, { band: 5, gain: 0.15 }, { band: 6, gain: -0.24 }, { band: 7, gain: -0.24 }, { band: 8, gain: -0.16 }, { band: 9, gain: -0.16 }, { band: 10, gain: 0 }, { band: 11, gain: 0 }, { band: 12, gain: 0 }, { band: 13, gain: 0 }], description: 'Pop EQ Filter' },
        rock: { bands: [{ band: 0, gain: 0.4 }, { band: 1, gain: 0.3 }, { band: 2, gain: -0.1 }, { band: 3, gain: 0.2 }, { band: 4, gain: 0.5 }, { band: 5, gain: 0.7 }, { band: 6, gain: 0.6 }, { band: 7, gain: 0.4 }, { band: 8, gain: 0.2 }, { band: 9, gain: 0.1 }, { band: 10, gain: 0.3 }, { band: 11, gain: 0.4 }, { band: 12, gain: 0.5 }, { band: 13, gain: 0.3 }], description: 'Rock EQ Filter' },
        electronic: { bands: [{ band: 0, gain: 0.8 }, { band: 1, gain: 0.6 }, { band: 2, gain: 0.2 }, { band: 3, gain: -0.1 }, { band: 4, gain: 0.1 }, { band: 5, gain: 0.3 }, { band: 6, gain: 0.5 }, { band: 7, gain: 0.7 }, { band: 8, gain: 0.8 }, { band: 9, gain: 0.6 }, { band: 10, gain: 0.4 }, { band: 11, gain: 0.3 }, { band: 12, gain: 0.2 }, { band: 13, gain: 0.1 }], description: 'Electronic EQ Filter' },
        jazz: { bands: [{ band: 0, gain: 0.2 }, { band: 1, gain: 0.1 }, { band: 2, gain: 0.3 }, { band: 3, gain: 0.4 }, { band: 4, gain: 0.5 }, { band: 5, gain: 0.3 }, { band: 6, gain: 0.2 }, { band: 7, gain: 0.1 }, { band: 8, gain: -0.1 }, { band: 9, gain: 0.0 }, { band: 10, gain: 0.1 }, { band: 11, gain: 0.2 }, { band: 12, gain: 0.3 }, { band: 13, gain: 0.2 }], description: 'Jazz EQ Filter' },
        classical: { bands: [{ band: 0, gain: 0.0 }, { band: 1, gain: 0.0 }, { band: 2, gain: 0.0 }, { band: 3, gain: 0.0 }, { band: 4, gain: 0.0 }, { band: 5, gain: 0.0 }, { band: 6, gain: -0.7 }, { band: 7, gain: -0.7 }, { band: 8, gain: -0.7 }, { band: 9, gain: -0.9 }, { band: 10, gain: -0.1 }, { band: 11, gain: -0.1 }, { band: 12, gain: 0.0 }, { band: 13, gain: -0.2 }], description: 'Classical EQ Filter' },
        hiphop: { bands: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.5 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.3 }, { band: 4, gain: -0.2 }, { band: 5, gain: -0.1 }, { band: 6, gain: 0.2 }, { band: 7, gain: -0.1 }, { band: 8, gain: -0.1 }, { band: 9, gain: 0.1 }, { band: 10, gain: 0.3 }, { band: 11, gain: 0.4 }, { band: 12, gain: 0.4 }, { band: 13, gain: 0.2 }], description: 'Hip-Hop EQ Filter' },
        reggae: { bands: [{ band: 0, gain: 0.0 }, { band: 1, gain: 0.0 }, { band: 2, gain: 0.0 }, { band: 3, gain: -0.5 }, { band: 4, gain: -0.1 }, { band: 5, gain: 0.2 }, { band: 6, gain: 0.3 }, { band: 7, gain: 0.0 }, { band: 8, gain: 0.0 }, { band: 9, gain: 0.0 }, { band: 10, gain: 0.0 }, { band: 11, gain: 0.0 }, { band: 12, gain: 0.0 }, { band: 13, gain: 0.0 }], description: 'Reggae EQ Filter' },
        bassboost: { bands: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.67 }, { band: 2, gain: 0.67 }, { band: 3, gain: 0 }, { band: 4, gain: -0.5 }, { band: 5, gain: 0.15 }, { band: 6, gain: -0.45 }, { band: 7, gain: 0.23 }, { band: 8, gain: 0.35 }, { band: 9, gain: 0.45 }, { band: 10, gain: 0.55 }, { band: 11, gain: 0.6 }, { band: 12, gain: 0.55 }, { band: 13, gain: 0 }], description: 'Bass Boost Filter' },
        superbass: { bands: [{ band: 0, gain: 0.8 }, { band: 1, gain: 0.8 }, { band: 2, gain: 0.5 }, { band: 3, gain: 0.2 }, { band: 4, gain: -0.2 }, { band: 5, gain: -0.1 }, { band: 6, gain: 0.0 }, { band: 7, gain: 0.1 }, { band: 8, gain: 0.2 }, { band: 9, gain: 0.3 }, { band: 10, gain: 0.4 }, { band: 11, gain: 0.5 }, { band: 12, gain: 0.4 }, { band: 13, gain: 0.2 }], description: 'Super Bass Filter' },
        deepbass: { bands: [{ band: 0, gain: 1.0 }, { band: 1, gain: 0.7 }, { band: 2, gain: 0.4 }, { band: 3, gain: 0.1 }, { band: 4, gain: -0.3 }, { band: 5, gain: -0.2 }, { band: 6, gain: -0.1 }, { band: 7, gain: 0.0 }, { band: 8, gain: 0.0 }, { band: 9, gain: 0.0 }, { band: 10, gain: 0.0 }, { band: 11, gain: 0.0 }, { band: 12, gain: 0.0 }, { band: 13, gain: 0.0 }], description: 'Deep Bass Filter' },
        boost: { bands: [{ band: 0, gain: 0.2 }, { band: 1, gain: 0.3 }, { band: 2, gain: 0.4 }, { band: 3, gain: 0.5 }, { band: 4, gain: 0.6 }, { band: 5, gain: 0.5 }, { band: 6, gain: 0.4 }, { band: 7, gain: 0.3 }, { band: 8, gain: 0.2 }, { band: 9, gain: 0.1 }, { band: 10, gain: 0.2 }, { band: 11, gain: 0.3 }, { band: 12, gain: 0.4 }, { band: 13, gain: 0.3 }], description: 'Audio Boost Filter' },
        soft: { bands: [{ band: 0, gain: 0.0 }, { band: 1, gain: 0.1 }, { band: 2, gain: 0.1 }, { band: 3, gain: 0.2 }, { band: 4, gain: 0.3 }, { band: 5, gain: 0.2 }, { band: 6, gain: 0.1 }, { band: 7, gain: 0.0 }, { band: 8, gain: -0.1 }, { band: 9, gain: -0.2 }, { band: 10, gain: -0.1 }, { band: 11, gain: 0.0 }, { band: 12, gain: 0.1 }, { band: 13, gain: 0.0 }], description: 'Soft Audio Filter' },
        flat: { bands: [{ band: 0, gain: 0.0 }, { band: 1, gain: 0.0 }, { band: 2, gain: 0.0 }, { band: 3, gain: 0.0 }, { band: 4, gain: 0.0 }, { band: 5, gain: 0.0 }, { band: 6, gain: 0.0 }, { band: 7, gain: 0.0 }, { band: 8, gain: 0.0 }, { band: 9, gain: 0.0 }, { band: 10, gain: 0.0 }, { band: 11, gain: 0.0 }, { band: 12, gain: 0.0 }, { band: 13, gain: 0.0 }], description: 'Flat Audio Filter' },
        warm: { bands: [{ band: 0, gain: 0.4 }, { band: 1, gain: 0.3 }, { band: 2, gain: 0.2 }, { band: 3, gain: 0.3 }, { band: 4, gain: 0.4 }, { band: 5, gain: 0.2 }, { band: 6, gain: 0.0 }, { band: 7, gain: -0.1 }, { band: 8, gain: -0.2 }, { band: 9, gain: -0.1 }, { band: 10, gain: 0.0 }, { band: 11, gain: 0.1 }, { band: 12, gain: 0.2 }, { band: 13, gain: 0.1 }], description: 'Warm Audio Filter' },
        nightcore: { timescale: { speed: 1.25, pitch: 1.25, rate: 1.0 }, description: 'Nightcore Filter' },
        vaporwave: { timescale: { speed: 0.85, pitch: 0.8, rate: 1.0 }, description: 'Vaporwave Filter' },
        treble: { bands: [{ band: 0, gain: -0.8 }, { band: 1, gain: -0.8 }, { band: 2, gain: -0.8 }, { band: 3, gain: -0.4 }, { band: 4, gain: 0.3 }, { band: 5, gain: 1.0 }, { band: 6, gain: 0.8 }, { band: 7, gain: 0.8 }, { band: 8, gain: 0.8 }, { band: 9, gain: 0.8 }, { band: 10, gain: 0.8 }, { band: 11, gain: 0.8 }, { band: 12, gain: 0.8 }, { band: 13, gain: 0.8 }], description: 'Treble Filter' },
        bright: { bands: [{ band: 0, gain: -0.2 }, { band: 1, gain: -0.1 }, { band: 2, gain: 0.0 }, { band: 3, gain: 0.1 }, { band: 4, gain: 0.2 }, { band: 5, gain: 0.4 }, { band: 6, gain: 0.6 }, { band: 7, gain: 0.7 }, { band: 8, gain: 0.8 }, { band: 9, gain: 0.7 }, { band: 10, gain: 0.6 }, { band: 11, gain: 0.5 }, { band: 12, gain: 0.4 }, { band: 13, gain: 0.3 }], description: 'Bright Filter' },
        vocals: { bands: [{ band: 0, gain: -0.2 }, { band: 1, gain: -0.3 }, { band: 2, gain: -0.3 }, { band: 3, gain: 0.1 }, { band: 4, gain: 0.9 }, { band: 5, gain: 0.9 }, { band: 6, gain: 0.5 }, { band: 7, gain: 0.2 }, { band: 8, gain: -0.1 }, { band: 9, gain: -0.2 }, { band: 10, gain: -0.3 }, { band: 11, gain: 0.0 }, { band: 12, gain: 0.4 }, { band: 13, gain: 0.6 }], description: 'Vocals Filter' },
        metal: { bands: [{ band: 0, gain: 0.0 }, { band: 1, gain: 0.1 }, { band: 2, gain: 0.15 }, { band: 3, gain: 0.2 }, { band: 4, gain: 0.3 }, { band: 5, gain: 0.5 }, { band: 6, gain: 0.75 }, { band: 7, gain: 0.65 }, { band: 8, gain: 0.55 }, { band: 9, gain: 0.4 }, { band: 10, gain: 0.25 }, { band: 11, gain: 0.2 }, { band: 12, gain: 0.15 }, { band: 13, gain: 0.1 }], description: 'Metal EQ Filter' },
        oldschool: { bands: [{ band: 0, gain: 0.1 }, { band: 1, gain: 0.05 }, { band: 2, gain: 0.0 }, { band: 3, gain: -0.05 }, { band: 4, gain: -0.1 }, { band: 5, gain: -0.15 }, { band: 6, gain: -0.2 }, { band: 7, gain: -0.25 }, { band: 8, gain: -0.3 }, { band: 9, gain: -0.35 }, { band: 10, gain: -0.4 }, { band: 11, gain: -0.45 }, { band: 12, gain: -0.5 }, { band: 13, gain: -0.55 }], description: 'Oldschool EQ Filter' },
    };
    static async apply(player, presetName) {
        if (!player || !player.filterManager)
            return false;
        const preset = this.presets[presetName.toLowerCase()];
        if (!preset)
            return false;
        if (preset.bands) {
            await player.filterManager.setEQ(preset.bands);
        }
        else if (preset.timescale) {
            // @ts-ignore
            await player.filterManager.setTimescale(preset.timescale);
        }
        return true;
    }
    static async reset(player) {
        if (!player || !player.filterManager)
            return false;
        await player.filterManager.resetFilters();
        return true;
    }
    static getPresetNames() {
        return Object.keys(this.presets);
    }
    static getPresetInfo(name) {
        return this.presets[name.toLowerCase()] || null;
    }
}
