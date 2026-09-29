import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { SignInResponse, User } from "@/api/types";
import { useSession } from "./session";

/**
 * The Shamba OS staff session, kept apart from the farmer session so signing
 * in to /admin never changes (or clears) a farm account signed in in the same
 * browser, and the other way round.
 */
interface AdminSessionState {
  access: string | null;
  refresh: string | null;
  user: User | null;
  signIn: (res: SignInResponse) => void;
  setTokens: (access: string, refresh?: string) => void;
  signOut: () => void;
}

export const useAdminSession = create<AdminSessionState>()(
  persist(
    (set) => ({
      access: null,
      refresh: null,
      user: null,
      signIn: (res) => set({ access: res.access, refresh: res.refresh, user: res.user }),
      setTokens: (access, refresh) => set((s) => ({ access, refresh: refresh ?? s.refresh })),
      signOut: () => set({ access: null, refresh: null, user: null }),
    }),
    {
      name: "shamba-admin-session",
      storage: createJSONStorage(() => localStorage),
      // As for farmers: the access token lives in memory only.
      partialize: ({ refresh, user }) => ({ refresh, user }),
    },
  ),
);

/** The browser's install id identifies this device for staff sign-in too. */
export const installId = () => useSession.getState().installId;
