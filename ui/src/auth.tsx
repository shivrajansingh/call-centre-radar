import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, login as apiLogin, setToken, type Me } from "./api";

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<Me>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({
  me: null,
  loading: true,
  login: async () => { throw new Error("no provider"); },
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setMe(null);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("radar_token")) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then(setMe)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
    const onLogout = () => setMe(null);
    window.addEventListener("radar:logout", onLogout);
    return () => window.removeEventListener("radar:logout", onLogout);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const user = await apiLogin(username, password);
    setMe(user);
    return user;
  }, []);

  return (
    <Ctx.Provider value={{ me, loading, login, logout }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);