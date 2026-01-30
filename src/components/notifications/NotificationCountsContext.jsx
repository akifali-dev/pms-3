"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DEFAULT_COUNTS = {
  total: 0,
  taskMovement: 0,
  creation: 0,
  log: 0,
};

const NotificationCountsContext = createContext(null);

export function NotificationCountsProvider({ children }) {
  const [counts, setCounts] = useState(DEFAULT_COUNTS);

  const refreshCounts = useCallback(async () => {
    const response = await fetch("/api/notifications/unread-counts");
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    if (data?.ok) {
      setCounts({
        total: data.unreadCounts?.total ?? 0,
        taskMovement: data.unreadCounts?.taskMovement ?? 0,
        creation: data.unreadCounts?.creation ?? 0,
        log: data.unreadCounts?.log ?? 0,
      });
    }
  }, []);

  useEffect(() => {
    refreshCounts();
    const interval = setInterval(refreshCounts, 30000);
    return () => clearInterval(interval);
  }, [refreshCounts]);

  const value = useMemo(
    () => ({
      counts,
      refreshCounts,
      setCounts,
    }),
    [counts, refreshCounts]
  );

  return (
    <NotificationCountsContext.Provider value={value}>
      {children}
    </NotificationCountsContext.Provider>
  );
}

export function useNotificationCounts() {
  const context = useContext(NotificationCountsContext);
  if (!context) {
    throw new Error(
      "useNotificationCounts must be used within NotificationCountsProvider."
    );
  }
  return context;
}
