import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const ANIMATION_MODES = new Set(['static', 'fluid', 'system']);

function readLegacySidebarCollapsed() {
    if (typeof window === 'undefined') return false;

    try {
        return window.localStorage.getItem('sidebar:collapsed') === '1';
    } catch {
        return false;
    }
}

export const useUiStore = create(
    persist(
        (set) => ({
            animationMode: 'static',
            sidebarCollapsed: readLegacySidebarCollapsed(),
            sidebarWidth: null,
            chartPeriods: {},
            chartLayouts: {},

            setAnimationMode: (mode) => {
                set({ animationMode: ANIMATION_MODES.has(mode) ? mode : 'static' });
            },

            setSidebarCollapsed: (collapsed) => {
                set({ sidebarCollapsed: Boolean(collapsed) });
            },

            setSidebarWidth: (width) => {
                const nextWidth = Number(width);
                set({ sidebarWidth: Number.isFinite(nextWidth) && nextWidth > 0 ? nextWidth : null });
            },

            toggleSidebarCollapsed: () => {
                set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
            },

            setChartPeriod: (chartKey, period) => {
                set((state) => ({
                    chartPeriods: {
                        ...state.chartPeriods,
                        [chartKey]: period,
                    },
                }));
            },

            resetChartPeriod: (chartKey) => {
                set((state) => {
                    const next = { ...state.chartPeriods };
                    delete next[chartKey];
                    return { chartPeriods: next };
                });
            },

            setChartLayout: (layoutId, layout) => {
                if (!layoutId || !Array.isArray(layout)) return;

                set((state) => ({
                    chartLayouts: {
                        ...state.chartLayouts,
                        [layoutId]: layout,
                    },
                }));
            },

            resetChartLayout: (layoutId) => {
                if (!layoutId) return;

                set((state) => {
                    const next = { ...state.chartLayouts };
                    delete next[layoutId];
                    return { chartLayouts: next };
                });
            },
        }),
        {
            name: 'budsjett-ui',
            version: 1,
            partialize: (state) => ({
                animationMode: state.animationMode,
                sidebarCollapsed: state.sidebarCollapsed,
                sidebarWidth: state.sidebarWidth,
                chartPeriods: state.chartPeriods,
                chartLayouts: state.chartLayouts,
            }),
        }
    )
);
