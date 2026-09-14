import { create } from 'zustand';

/*
 * The Support panel lives once, in OperatorShell, the same way the command
 * palette does -- but unlike the palette, a page needs to be able to open it
 * pre-seeded with a question (the "Why did this fail?" entry points). A
 * store, the same pattern the notifications inbox already uses to let any
 * component push into a UI surface it does not own, is what lets a page
 * reach the shell's panel without a bespoke context of its own.
 */

interface SupportUIState {
  open: boolean;
  /** Set only when opened with a question already in mind, and cleared on
   * close so re-opening later starts blank. */
  initialMessage: string | null;
  /** Open the panel, optionally sending this question immediately. */
  openSupport: (initialMessage?: string) => void;
  setOpen: (open: boolean) => void;
}

export const useSupportUIStore = create<SupportUIState>((set) => ({
  open: false,
  initialMessage: null,
  openSupport: (initialMessage) => set({ open: true, initialMessage: initialMessage ?? null }),
  setOpen: (open) => set((state) => ({ open, initialMessage: open ? state.initialMessage : null })),
}));
