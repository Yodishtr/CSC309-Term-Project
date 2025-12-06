import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("authToken"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [currentView, setCurrentView] = useState(null);

  // If token disappears (manually removed or expired), force logout
  useEffect(() => {
    if (!token) {
      logout();
    }
  }, [token]);

  // fetch current user info when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      setCurrentView(null);
      setLoading(false);
      return;
    }

    async function fetchMe() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/users/me`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch user");
        }

        const data = await res.json();
        setUser(data);
        
        // always set currentView: use stored value if valid, otherwise use user's role
        const storedView = localStorage.getItem("currentView");
        const validViews = ["regular"];
        if (data.role === "cashier") validViews.push("cashier");
        if (data.role === "manager") validViews.push("cashier", "manager");
        if (data.role === "superuser") validViews.push("cashier", "manager", "superuser");
        
        const viewToUse = (storedView && validViews.includes(storedView)) ? storedView : data.role;
        setCurrentView(viewToUse);
        localStorage.setItem("currentView", viewToUse);
      } catch (err) {
        console.error("Error fetching /users/me:", err);
        localStorage.removeItem("authToken");
        localStorage.removeItem("authTokenExpiresAt");
        localStorage.removeItem("currentView");
        setToken(null);
        setUser(null);
        setCurrentView(null);
      } finally {
        setLoading(false);
      }
    }

    fetchMe();
  }, [token]);

  function login({ token, expiresAt }) {
    localStorage.setItem("authToken", token);
    localStorage.setItem("authTokenExpiresAt", expiresAt);
    setToken(token);
  }

  function logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authTokenExpiresAt");
    localStorage.removeItem("currentView");
    setToken(null);
    setUser(null);
    setCurrentView(null);
  }

  function switchView(newView) {
    setCurrentView(newView);
    localStorage.setItem("currentView", newView);
  }

  // determine available views based on user role
  function getAvailableViews() {
    if (!user) return [];
    
    const views = ["regular"]; // everyone can access regular view
    
    if (user.role === "cashier") {
      views.push("cashier");
    }
    
    if (user.role === "manager") {
      views.push("cashier", "manager");
    }
    
    if (user.role === "superuser") {
      views.push("cashier", "manager", "superuser");
    }
    
    // TODO: "organizer" role and view
    
    return views;
  }

  const availableViews = getAvailableViews();

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading, 
        currentView,
        availableViews,
        login, 
        logout,
        switchView
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}