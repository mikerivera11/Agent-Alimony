"use client";

import { clearLocalCaseData } from "@/domain/intake/localData";

import { dangerLinkClasses } from "./fields/inputStyles";

/** A neutral, low-suspicion site to redirect to. Weather.gov is a plain US government page. */
const QUICK_EXIT_URL = "https://www.weather.gov";

/**
 * A persistent "quick exit" control for anyone who needs to leave this site
 * immediately and land somewhere unremarkable. It first removes the app's
 * browser-saved case data and starts a keepalive sign-out request so the
 * server session is revoked even as the current tab leaves the app.
 */
export function QuickExitLink() {
  return (
    <a
      href={QUICK_EXIT_URL}
      onClick={(event) => {
        event.preventDefault();
        clearLocalCaseData();
        try {
          void fetch("/api/auth/signout", {
            method: "POST",
            keepalive: true,
            headers: { accept: "application/json" },
          }).catch(() => {
            // Leaving immediately is the safety priority. Local data is
            // already gone even if the server cannot be reached.
          });
        } catch {
          // Some browsers can reject keepalive requests synchronously. The
          // neutral redirect must still happen.
        }
        window.location.replace(QUICK_EXIT_URL);
      }}
      className={dangerLinkClasses}
      aria-label="Quick exit: sign out, clear this app's saved browser data, and go to a neutral weather page"
    >
      Quick exit
    </a>
  );
}
