import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearSession,
  fetchMe,
  getStoredToken,
  persistSession,
  setAuthToken,
  type MeResponse,
} from "../api/client";

type AuthState =
  | { status: "loading" }
  | { status: "authed"; user: MeResponse }
  | { status: "anon" };

type Ctx = {
  state: AuthState;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  /** 重新拉取 /api/users/me（如更换头像后） */
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const bootstrap = useCallback(async () => {
    const t = getStoredToken();
    if (!t) {
      setState({ status: "anon" });
      return;
    }
    setAuthToken(t);
    try {
      const user = await fetchMe();
      setState({ status: "authed", user });
    } catch {
      clearSession();
      setState({ status: "anon" });
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const loginWithToken = useCallback(async (token: string) => {
    persistSession(token);
    const user = await fetchMe();
    setState({ status: "authed", user });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setState({ status: "anon" });
  }, []);

  const refreshMe = useCallback(async () => {
    const t = getStoredToken();
    if (!t) return;
    setAuthToken(t);
    try {
      const user = await fetchMe();
      setState((prev) => (prev.status === "authed" ? { status: "authed", user } : prev));
    } catch {
      clearSession();
      setState({ status: "anon" });
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ state, loginWithToken, logout, refreshMe }),
    [state, loginWithToken, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return c;
}

export function useAuthedUser(): MeResponse | null {
  const { state } = useAuth();
  return state.status === "authed" ? state.user : null;
}
