import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem("hire_token");
    const role = localStorage.getItem("hire_role");
    const email = localStorage.getItem("hire_email");
    return token ? { token, role, email } : null;
  });

  const login = useCallback(async (email, password, expectedRole) => {
    const data = await api.login(email, password, expectedRole);
    localStorage.setItem("hire_token", data.access_token);
    localStorage.setItem("hire_role", data.role);
    localStorage.setItem("hire_email", data.email);
    setAuth({ token: data.access_token, role: data.role, email: data.email });
    return data; // includes must_change_password
  }, []);

  /* Adopt a session that was issued by something other than the login form.
     The OTP password reset hands back a token because the user has just
     proved they own the account — sending them to the login screen to type
     the password they set ten seconds ago is friction with no security
     benefit. Same storage keys as login(), so everything downstream is
     identical whichever door they came through. */
  const setSession = useCallback((data) => {
    if (!data?.access_token) return null;
    localStorage.setItem("hire_token", data.access_token);
    localStorage.setItem("hire_role", data.role);
    localStorage.setItem("hire_email", data.email);
    setAuth({ token: data.access_token, role: data.role, email: data.email });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hire_token");
    localStorage.removeItem("hire_role");
    localStorage.removeItem("hire_email");
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
