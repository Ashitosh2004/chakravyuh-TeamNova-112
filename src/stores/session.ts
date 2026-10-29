import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/services/api";

/**
 * Session state. Two explicit modes:
 *  - "backend": user returned by the Zcode backend (cookie session, nothing secret stored here).
 *  - "development": a clearly-labelled local preview session used while the backend
 *    is not connected. It is NOT authentication and grants no server access.
 * Only non-sensitive profile fields are persisted. No passwords or tokens.
 */
export type SessionMode = "backend" | "development";

interface SessionState {
  user: User | null;
  mode: SessionMode | null;
  expired: boolean;
  setSession: (user: User, mode: SessionMode) => void;
  updateUser: (patch: Partial<User>) => void;
  clear: (expired?: boolean) => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      mode: null,
      expired: false,
      setSession: (user, mode) => set({ user, mode, expired: false }),
      updateUser: (patch) => set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
      clear: (expired = false) => set({ user: null, mode: null, expired }),
    }),
    { name: "chakravyuh-session-v1", partialize: (s) => ({ user: s.user, mode: s.mode }) },
  ),
);

export function startDevelopmentSession(displayName: string, email: string) {
  useSession.getState().setSession(
    { id: "dev-local", email, displayName: displayName || "Student", level: "beginner" },
    "development",
  );
}
