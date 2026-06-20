"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { setUserLocale } from "@iedora/product-menu/features/dashboard-home/actions";

/**
 * EN / PT segmented pill in the landing nav — mirrors the Pencil Lang Switch.
 * Reuses the dashboard `setUserLocale` action: it sets the NEXT_LOCALE cookie
 * and revalidates the layout, then we refresh to re-render in the new locale.
 */
const LOCALES = ["en", "pt"] as const;

export function LangSwitch() {
  const current = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(next: string) {
    if (next === current || pending) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  }

  return (
    <div className="hidden items-center gap-0.5 rounded-full bg-[var(--muted)] p-[3px] sm:inline-flex" role="group" aria-label="Language">
      {LOCALES.map((code) => {
        const active = code === current;
        return (
          <button
            key={code}
            type="button"
            onClick={() => select(code)}
            disabled={active || pending}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-1 text-[13px] font-bold uppercase transition-colors disabled:cursor-default ${
              active ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
