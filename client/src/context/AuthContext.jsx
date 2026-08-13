import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { setAccessToken, setUnauthorizedHandler, refreshAccessToken } from "../api/client";
import { authApi } from "../api/resources";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // true once initial silent-refresh attempt finishes

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
  }, [clearSession]);

  // On first load there's no in-memory access token (it never survives a
  // refresh) — try the httpOnly refresh cookie silently to restore a session.
  // Reuses api/client.js's refreshAccessToken so the API base URL (and its
  // VITE_API_URL handling for prod) only lives in one place.
  useEffect(() => {
    (async () => {
      try {
        const refreshed = await refreshAccessToken();
        if (refreshed) setUser(refreshed.user);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback(async (payload) => {
    const data = await authApi.signup(payload);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  return (
    <AuthContext.Provider value={{ user, ready, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
