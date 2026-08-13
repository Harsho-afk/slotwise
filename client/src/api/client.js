// In dev, the Vite proxy (vite.config.js) forwards "/api" to the backend,
// so a relative base works with no config. In production the client and
// API are typically on different origins (see DEPLOYMENT.md §4), so
// VITE_API_URL — when set — is prefixed onto every request instead.
const API_BASE = `${import.meta.env.VITE_API_URL || ""}/api/v1`;

// The access token lives only in module memory — never localStorage — so
// an XSS bug can't read it off disk. It's lost on a hard refresh, which is
// fine: the httpOnly refresh cookie silently gets us a new one on load.
let accessToken = null;
let onUnauthorized = () => {};

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

// Returns the full { accessToken, user } payload (or null) so callers that
// need the user object — like AuthContext's silent-refresh-on-load — don't
// have to duplicate this fetch with their own hardcoded URL.
async function refreshAccessToken() {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    credentials: "include", // send the httpOnly refresh cookie
  });
  if (!res.ok) return null;
  const data = await res.json();
  setAccessToken(data.accessToken);
  return data;
}

/**
 * Wrapper around fetch that:
 * - attaches Authorization: Bearer <token>
 * - sends/receives the refresh cookie
 * - on a 401, tries exactly one silent refresh + retry before giving up
 */
export async function apiFetch(path, options = {}) {
  const doFetch = (token) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

  let res = await doFetch(accessToken);

  if (res.status === 401 && accessToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch(refreshed.accessToken);
    } else {
      setAccessToken(null);
      onUnauthorized();
    }
  }

  return res;
}

export async function apiJson(path, options = {}) {
  const res = await apiFetch(path, options);
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.details = body?.details;
    throw err;
  }
  return body;
}

export { refreshAccessToken };
