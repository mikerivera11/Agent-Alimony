"use client";

import { dangerLinkClasses } from "./fields/inputStyles";

/** A neutral, low-suspicion site to redirect to. Weather.gov is a plain US government page. */
const QUICK_EXIT_URL = "https://www.weather.gov";

/**
 * A persistent "quick exit" control for anyone who needs to leave this site
 * immediately and land somewhere unremarkable. Replaces the current tab
 * (rather than opening a new one) so nothing about this tool stays visible.
 */
export function QuickExitLink() {
  return (
    <a
      href={QUICK_EXIT_URL}
      onClick={(event) => {
        event.preventDefault();
        window.location.replace(QUICK_EXIT_URL);
      }}
      className={dangerLinkClasses}
      aria-label="Quick exit: leave this site immediately and go to a neutral weather page"
    >
      Quick exit
    </a>
  );
}
