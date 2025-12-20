// admin/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

// Keys we already use in localStorage
const TOKEN_KEY = 'serviceup.jwt';
const USER_KEY = 'serviceup.user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);          // { id, email, role, ... }
  const [token, setToken] = useState(null);        // JWT string
  const [permissions, setPermissions] = useState([]); // ['users.manage', 'entries.edit:movie', ...]
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPermissions, setLoadingPermissions] = useState(false);

  // On first load, hydrate from localStorage
  useEffect(() => {
    try {
      const storedToken =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(TOKEN_KEY)
          : null;
      const storedUser =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(USER_KEY)
          : null;

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error('[AuthProvider] Failed to read localStorage', err);
      setToken(null);
      setUser(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  // When user + token present, load permissions for their role
  useEffect(() => {
    async function loadPermissions() {
      if (!user?.role || !token) {
        setPermissions([]);
        return;
      }

      setLoadingPermissions(true);
      try {
        const roleSlug = user.role; // e.g. 'ADMIN'
        const res = await api.get(`/api/permissions/by-role/${roleSlug}`);
        // Expect: [{ slug, ..., allowed }]
        const granted = (res || [])
          .filter((p) => p.allowed)
          .map((p) => p.slug);
        setPermissions(granted);
      } catch (err) {
        console.error('[AuthProvider] Failed to load permissions', err);
        setPermissions([]);
      } finally {
        setLoadingPermissions(false);
      }
    }

    loadPermissions();
  }, [user?.role, token]);

  // Optional helpers (you can wire your Login page to these later)
  function login(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, nextToken);
      window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    setPermissions([]);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
  }

  const value = {
    user,
    token,
    permissions,
    loadingAuth,
    loadingPermissions,
    login,
    logout,
    setUser,
    setToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
