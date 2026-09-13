"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/** Restyled per §5.9 (T1.10): `unstyled` + token classNames, no `richColors`.
 * Position is responsive — `bottom-left` on desktop, `top-center` on mobile
 * (Midday's own convention), switched via a resize listener since Sonner's
 * `position` prop isn't itself responsive. */
export function AppToaster() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <Toaster
      position={isMobile ? "top-center" : "bottom-left"}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "bg-toast border border-border text-foreground p-5 flex gap-3 w-full",
          title: "text-sm",
          description: "text-xs text-muted-foreground",
        },
      }}
    />
  );
}
