"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function AlertOverride() {
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.alert = (message) => {
        const msgStr = String(message);
        if (
          msgStr.startsWith("✅") ||
          msgStr.toLowerCase().includes("berhasil") ||
          msgStr.toLowerCase().includes("sukses")
        ) {
          toast.success(msgStr.replace(/^✅\s*/, ""), { duration: 4000 });
        } else {
          toast.error(msgStr, { duration: 4000 });
        }
      };
    }
  }, []);

  return null;
}
