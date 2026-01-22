"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

export default function AccessDeniedToast() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) {
      return;
    }

    const denied = searchParams.get("denied");
    if (!denied) {
      return;
    }

    shownRef.current = true;
    const reason = searchParams.get("reason");
    addToast({
      title: "Access denied",
      message: reason ?? "You do not have access to that resource.",
      variant: "error",
    });
  }, [addToast, searchParams]);

  return null;
}
