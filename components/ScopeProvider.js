"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ScopeContext = createContext({ scope: "all", setScope: () => {}, scopes: ["all"], labels: {} });

export function ScopeProvider({ scopes = ["all"], labels = {}, children }) {
  const [scope, setScopeState] = useState("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bgl_scope");
      if (saved && scopes.includes(saved)) setScopeState(saved);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setScope(s) {
    setScopeState(s);
    try {
      localStorage.setItem("bgl_scope", s);
    } catch {}
  }

  return (
    <ScopeContext.Provider value={{ scope, setScope, scopes, labels }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  return useContext(ScopeContext);
}
