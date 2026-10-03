import { create } from 'zustand';

/* Tiny shared UI store. Currently only the coach-dock panel state, so the
   Open World toolbar can open it from inside the trading screen. */

export const useUI = create((set) => ({
  agentOpen: false,
  openAgent: () => set({ agentOpen: true }),
  closeAgent: () => set({ agentOpen: false }),
  toggleAgent: () => set((s) => ({ agentOpen: !s.agentOpen })),
}));