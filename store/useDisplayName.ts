"use client";

import { create } from "zustand";

interface DisplayNameState {
  // Starts null on both server and client so the first render matches the
  // server HTML; AppShell seeds the real value (and `ready`) at mount.
  name: string | null;
  ready: boolean;
  setName: (name: string) => void;
}

export const useDisplayName = create<DisplayNameState>((set) => ({
  name: null,
  ready: false,
  setName: (name) => set({ name }),
}));