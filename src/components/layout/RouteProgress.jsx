"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const NAV_EVENT = "pms:navigation-start";

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timers = useRef([]);

  const clearTimers = () => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current = [];
  };

  const start = () => {
    clearTimers();
    setIsVisible(true);
    setProgress(20);
    timers.current.push(setTimeout(() => setProgress(60), 120));
    timers.current.push(setTimeout(() => setProgress(85), 300));
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    timers.current.push(
      setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 200)
    );
  };

  useEffect(() => {
    const handleStart = () => start();
    const handleClick = (event) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = event.target?.closest?.("a");
      if (!anchor || anchor.target === "_blank") {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) {
        return;
      }
      start();
    };
    window.addEventListener(NAV_EVENT, handleStart);
    document.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener(NAV_EVENT, handleStart);
      document.removeEventListener("click", handleClick);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    if (isVisible) {
      finish();
    }
  }, [pathname, searchParams?.toString()]);

  return (
    <div className="pointer-events-none fixed left-[var(--sidebar-width)] right-0 top-[var(--header-height)] z-40 h-1">
      <div
        className="h-full rounded-full bg-[color:var(--color-accent)] transition-all duration-300"
        style={{
          width: `${progress}%`,
          opacity: isVisible ? 1 : 0,
        }}
      />
    </div>
  );
}
