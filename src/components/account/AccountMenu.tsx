"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui";

/**
 * Header control for signing in and out.
 *
 * It renders nothing at all until it knows whether sign-in is configured on
 * this deployment. Offering a button that leads to a 501 would be worse than
 * offering none, and the app is fully usable without an account either way.
 *
 * The copy names the trade-off plainly rather than selling the feature:
 * creating an account means this service stores the financial answers, which
 * someone entering details of their own divorce deserves to be told before
 * they click, not after.
 */

export interface SessionInfo {
  signedIn: boolean;
  googleConfigured: boolean;
  email?: string | null;
  displayName?: string | null;
}

export function AccountMenu() {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { headers: { accept: "application/json" } })
      .then((response) => (response.ok ? (response.json() as Promise<SessionInfo>) : null))
      .then((body) => {
        if (!cancelled && body) setInfo(body);
      })
      .catch(() => {
        // Sign-in state is not essential to using the app; failing quietly
        // leaves the anonymous experience untouched.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }, []);

  if (!info || !info.googleConfigured) {
    return null;
  }

  if (!info.signedIn) {
    const redirect = typeof window === "undefined" ? "/" : window.location.pathname;
    return (
      <a
        href={`/api/auth/google/start?redirect=${encodeURIComponent(redirect)}`}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink underline-offset-4 hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <GoogleMark />
        Save my work — sign in
      </a>
    );
  }

  return (
    <span className="flex items-center gap-3 text-sm">
      <span className="text-muted">
        Signed in{info.email ? ` as ${info.email}` : ""}
      </span>
      <Button variant="ghost" size="sm" loading={busy} onClick={signOut}>
        Sign out
      </Button>
    </span>
  );
}

/** Google's brand mark, used only to label the sign-in affordance. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.94v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.94a9 9 0 0 0 0 8.1l3.03-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .94 4.95l3.03 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
