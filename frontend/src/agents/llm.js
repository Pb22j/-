/* ============================================================
   طبقة النموذج — provider-agnostic LLM bridge
   ------------------------------------------------------------
   The agents do NOT depend on any single vendor.

     1. If the FastAPI backend is reachable and a key is configured,
        the request is proxied there (Gemini today, anything later).
     2. If not, `complete()` falls back to a deterministic composer that
        assembles the answer from the retrieved knowledge entries.

   Consequence: the whole multi-agent system works offline, with no
   keys, and upgrades to live generation the moment a key exists.
   ============================================================ */

const TIMEOUT_MS = 12000;

let backendUp = null;   // tri-state cache: null = unknown

async function backendAlive() {
  if (backendUp !== null) return backendUp;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1200);
    const r = await fetch('/health', { signal: ctrl.signal });
    clearTimeout(t);
    backendUp = r.ok;
  } catch {
    backendUp = false;
  }
  return backendUp;
}

/** Force a re-probe (used by the settings screen and tests). */
export function resetBackendProbe() { backendUp = null; }
export function backendStatus() { return backendUp; }

/** Strip markdown emphasis — the UI has no markdown renderer and raw
    `**bold**` markers read as noise in Arabic. */
export function stripMarkdown(s) {
  return String(s || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '· ')
    .replace(/\*\*/g, '')        // leftover unbalanced markers
    .replace(/\s+/g, ' ')
    .trim();
}

/** Normalised token set, for similarity checks. */
const tokensOf = (s) => new Set(
  String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t.length > 1)
);

/**
 * Does the reply just hand the question back?
 *
 * A misconfigured or echoing upstream model returns the prompt back, sometimes
 * with small corruptions. Showing that as the agent's reply is worse than showing
 * nothing, so we detect it and fall back to the deterministic composition.
 *
 * The signal is question coverage: an echo carries essentially the whole
 * question's vocabulary, and is not much longer than the question. A real answer
 * quotes a word or two and then says something new.
 */
export function isEcho(reply, question) {
  const a = tokensOf(reply);
  const b = tokensOf(question);
  if (a.size === 0 || b.size === 0) return false;
  let covered = 0;
  for (const t of b) if (a.has(t)) covered++;
  const coverage = covered / b.size;
  const lengthRatio = a.size / b.size;
  return coverage > 0.8 && lengthRatio <= 2;
}

/**
 * Ask the model. Always resolves — never throws — so a screen can render
 * even with no network and no key.
 *
 * @param {object} o
 * @param {string} o.system   system prompt (already includes COMPLIANCE_BRIEF)
 * @param {string} o.prompt   user turn
 * @param {string} [o.fallback] deterministic answer used when no model is reachable
 * @param {string} [o.question] the learner's own words, for echo detection
 * @returns {Promise<{text:string, source:'llm'|'offline', error?:string}>}
 */
export async function complete({ system, prompt, fallback = '', context = {}, question = '' }) {
  if (await backendAlive()) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, context, system }),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.ok) {
        const data = await r.json();
        const raw = data.reply || data.text || data.message;
        const text = stripMarkdown(raw);
        if (text && !isEcho(text, question || prompt)) return { text, source: 'llm' };
        if (text) return { text: fallback, source: 'offline', error: 'echo-discarded' };
      }
    } catch (e) {
      // fall through to offline composition
    }
  }
  return { text: fallback, source: 'offline', error: backendUp === false ? 'backend-unreachable' : undefined };
}
