/**
 * Framework-agnostic session cookie configuration and serialization. Kept
 * decoupled from Next.js's `cookies()`/`headers()` APIs so app routes can
 * pass the resulting descriptor to whichever cookie-setting mechanism they
 * use, and so this module stays trivially unit-testable.
 */

export const SESSION_COOKIE_NAME = "fsg_session";

export interface SessionCookieAttributes {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  expires: Date;
}

/** `secure` must be true whenever the app could be served over HTTPS in production; only relaxed for local http development. */
function isSecureContext(): boolean {
  return process.env.NODE_ENV === "production";
}

export function buildSessionCookieAttributes(expiresAt: Date): SessionCookieAttributes {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureContext(),
    path: "/",
    expires: expiresAt,
  };
}

export interface SessionCookieDescriptor {
  name: string;
  value: string;
  attributes: SessionCookieAttributes;
}

export function buildSessionCookie(token: string, expiresAt: Date): SessionCookieDescriptor {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    attributes: buildSessionCookieAttributes(expiresAt),
  };
}

/** Descriptor that immediately expires the cookie, for logout/revocation flows. */
export function buildClearedSessionCookie(): SessionCookieDescriptor {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    attributes: buildSessionCookieAttributes(new Date(0)),
  };
}

/**
 * Serializes a cookie descriptor into a raw `Set-Cookie` header value. Provided
 * for environments/tests that want a plain string rather than framework cookie
 * APIs; Next.js route handlers should generally prefer passing the descriptor
 * fields directly to `cookies().set(...)`.
 */
export function serializeSessionCookie(descriptor: SessionCookieDescriptor): string {
  const { name, value, attributes } = descriptor;
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${attributes.path}`,
    `Expires=${attributes.expires.toUTCString()}`,
    "HttpOnly",
    `SameSite=${attributes.sameSite === "lax" ? "Lax" : attributes.sameSite}`,
  ];
  if (attributes.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
