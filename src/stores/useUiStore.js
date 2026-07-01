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
            chartPeriods: {},

            setAnimationMode: (mode) => {
                set({ animationMode: ANIMATION_MODES.has(mode) ? mode : 'static' });
            },

            setSidebarCollapsed: (collapsed) => {
                set({ sidebarCollapsed: Boolean(collapsed) });
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
        }),
        {
            name: 'budsjett-ui',
            version: 1,
            partialize: (state) => ({
                animationMode: state.animationMode,
                sidebarCollapsed: state.sidebarCollapsed,
                chartPeriods: state.chartPeriods,
            }),
        }
    )
);
