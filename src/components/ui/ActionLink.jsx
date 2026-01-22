"use client";

import { useRouter } from "next/navigation";
import { useToast } from "./ToastProvider";

export default function ActionLink({ href, label, toast, className = "" }) {
  const router = useRouter();
  const { addToast } = useToast();

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        addToast(toast);
        router.push(href);
      }}
    >
      {label}
    </button>
  );
}
