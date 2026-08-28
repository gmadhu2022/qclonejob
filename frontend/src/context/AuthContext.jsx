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

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem("hire_token", data.access_token);
    localStorage.setItem("hire_role", data.role);
    localStorage.setItem("hire_email", data.email);
    setAuth({ token: data.access_token, role: data.role, email: data.email });
    return data; // includes must_change_password
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hire_token");
    localStorage.removeItem("hire_role");
    localStorage.removeItem("hire_email");
    setAuth(null);
  }, []);

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
