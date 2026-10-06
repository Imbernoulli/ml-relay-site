"use client";

// Signing in IS asking for access: a signed-in visitor who is not yet a collaborator on the private
// repository gets an access request filed automatically, with no second click. Idempotent: the
// sign-in service returns the existing record for a pending (or approved, not yet accepted) request
// and does nothing for collaborators; here, one check per browser session, and never a re-request
// after a maintainer declined (the visitor can still ask again by hand).
import { isSignedIn } from "./github";
import { hasRepoAccess, myAccessRequest, requestAccess, type AccessRequest } from "./access";

const SESSION_KEY = "mlrelay-access-auto-checked";
/** Window event fired when an access request was filed automatically (detail: the AccessRequest). */
export const AUTO_ACCESS_EVENT = "mlrelay-access-auto";
export const AUTO_NOTE = "Requested automatically at sign-in.";

let inflight: Promise<AccessRequest | null> | null = null;

export function ensureAccessRequest(force = false): Promise<AccessRequest | null> {
  if (!isSignedIn()) return Promise.resolve(null);
  if (!force) {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return Promise.resolve(null);
    } catch {}
  }
  inflight ??= (async () => {
    try {
      const has = await hasRepoAccess();
      if (has === null) return null; // GitHub did not answer: try again on the next page load
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {}
      if (has) return null; // already a collaborator: nothing to do
      const me = await myAccessRequest();
      if (me.state !== "none") return me; // pending / approved / denied / has-access: never re-filed
      const r = await requestAccess(AUTO_NOTE);
      if (r.state === "pending") {
        try {
          window.dispatchEvent(new CustomEvent(AUTO_ACCESS_EVENT, { detail: r }));
        } catch {}
      }
      return r;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
