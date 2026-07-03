'use client';

import { create } from 'zustand';

interface WorkbenchState {
  selectedShotId: string | null;
  setSelectedShot: (id: string | null) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set) => ({
  selectedShotId: null,
  setSelectedShot: (id) => set({ selectedShotId: id }),
}));
