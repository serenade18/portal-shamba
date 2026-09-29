import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Capability, MembershipSummary, SignInResponse, User } from "@/api/types";

function newInstallId(): string {
  return crypto.randomUUID();
}

interface SessionState {
  /** Identifies this browser as a device to the API. Kept across sign-outs. */
  installId: string;
  access: string | null;
  refresh: string | null;
  deviceId: string | null;
  user: User | null;
  memberships: MembershipSummary[];
  activeOrgId: string | null;

  signIn: (res: SignInResponse) => void;
  setTokens: (access: string, refresh?: string) => void;
  setUser: (user: User) => void;
  setMemberships: (memberships: MembershipSummary[]) => void;
  switchOrg: (orgId: string) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      installId: newInstallId(),
      access: null,
      refresh: null,
      deviceId: null,
      user: null,
      memberships: [],
      activeOrgId: null,

      signIn: (res) =>
        set({
          access: res.access,
          refresh: res.refresh,
          deviceId: res.device_id,
          user: res.user,
          memberships: res.memberships,
          activeOrgId: pickOrg(res.memberships, get().activeOrgId),
        }),
      setTokens: (access, refresh) => set((s) => ({ access, refresh: refresh ?? s.refresh })),
      setUser: (user) => set({ user }),
      setMemberships: (memberships) => set((s) => ({ memberships, activeOrgId: pickOrg(memberships, s.activeOrgId) })),
      switchOrg: (orgId) => set({ activeOrgId: orgId }),
      signOut: () => set({ access: null, refresh: null, deviceId: null, user: null, memberships: [], activeOrgId: null }),
    }),
    {
      name: "shamba-session",
      storage: createJSONStorage(() => localStorage),
      // The access token lives in memory only; the refresh token gets a new one on load.
      partialize: ({ installId, refresh, deviceId, user, memberships, activeOrgId }) => ({
        installId,
        refresh,
        deviceId,
        user,
        memberships,
        activeOrgId,
      }),
    },
  ),
);

function pickOrg(memberships: MembershipSummary[], current: string | null): string | null {
  if (current && memberships.some((m) => m.organisation_id === current)) return current;
  return memberships[0]?.organisation_id ?? null;
}

export function useMembership(): MembershipSummary | null {
  return useSession((s) => s.memberships.find((m) => m.organisation_id === s.activeOrgId) ?? null);
}

/** UI convenience only: the server redacts money for callers without money.read. */
export function useCan(capability: Capability): boolean {
  const membership = useMembership();
  return membership?.capabilities.includes(capability) ?? false;
}
