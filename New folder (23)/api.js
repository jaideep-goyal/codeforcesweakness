/* ═══════════════════════════════════════════════════
   api.js — Codeforces API Service
   Pure client-side — works on GitHub Pages, file://, etc.
   Uses unauthenticated CF API (no key needed).
   ═══════════════════════════════════════════════════ */

const CF_API = "https://codeforces.com/api";

/**
 * Build API URL (unauthenticated — works everywhere).
 */
function buildUrl(method, params = {}) {
  const paramStr = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return paramStr ? `${CF_API}/${method}?${paramStr}` : `${CF_API}/${method}`;
}

/**
 * Fetch with timeout (default 20 seconds).
 */
async function fetchWithTimeout(url, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === "AbortError") {
      throw new Error("Request timed out. Codeforces may be slow — try again.");
    }
    throw e;
  }
}

/**
 * Small delay to respect CF rate limits (1 req / second).
 */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch user info from Codeforces API.
 */
async function fetchUserInfo(handle) {
  const url = buildUrl("user.info", { handles: handle });
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  if (data.status !== "OK") throw new Error(data.comment || "User not found");
  return data.result[0];
}

/**
 * Fetch ALL submissions for a user.
 */
async function fetchAllSubmissions(handle) {
  const url = buildUrl("user.status", {
    handle,
    from: 1,
    count: 100000,
  });
  const res = await fetchWithTimeout(url, 30000); // longer timeout for big users
  const data = await res.json();
  if (data.status !== "OK")
    throw new Error(data.comment || "Could not fetch submissions");
  return data.result;
}

/**
 * Fetch user rating history.
 */
async function fetchRatingHistory(handle) {
  const url = buildUrl("user.rating", { handle });
  const res = await fetchWithTimeout(url);
  const data = await res.json();
  if (data.status !== "OK") return []; // non-fatal
  return data.result;
}

/**
 * Fetch the full Codeforces problemset (for recommendations / POTD).
 * Cached in-memory to avoid repeated fetches.
 */
let _problemsetCache = null;
async function fetchProblemset() {
  if (_problemsetCache) return _problemsetCache;
  const url = buildUrl("problemset.problems", {});
  const res = await fetchWithTimeout(url, 25000);
  const data = await res.json();
  if (data.status !== "OK") throw new Error("Could not fetch problemset");
  _problemsetCache = data.result.problems;
  return _problemsetCache;
}

/**
 * Fetch upcoming & running contests from Codeforces.
 * Returns contests sorted by start time (soonest first).
 */
let _contestListCache = null;
let _contestListTime = 0;
async function fetchContestList() {
  // Cache for 5 minutes
  if (_contestListCache && Date.now() - _contestListTime < 300000) {
    return _contestListCache;
  }
  const url = buildUrl("contest.list", {});
  const res = await fetchWithTimeout(url, 15000);
  const data = await res.json();
  if (data.status !== "OK") throw new Error("Could not fetch contest list");
  // Filter: only BEFORE (upcoming) and CODING (running)
  const upcoming = data.result.filter(
    (c) => c.phase === "BEFORE" || c.phase === "CODING",
  );
  upcoming.sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  _contestListCache = upcoming;
  _contestListTime = Date.now();
  return _contestListCache;
}
