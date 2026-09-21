/**
 * Cache em memória com TTL e um "throttle" simples para respeitar o rate
 * limit de APIs públicas gratuitas. Cada provedor (Jikan, AniList...) cria
 * a sua própria instância, já que os limites são diferentes entre eles.
 */

function createCache(ttlMs) {
  const map = new Map();
  return {
    get(key) {
      const hit = map.get(key);
      if (!hit) return null;
      if (Date.now() - hit.time > ttlMs) {
        map.delete(key);
        return null;
      }
      return hit.value;
    },
    set(key, value) {
      map.set(key, { value, time: Date.now() });
    },
    size() {
      return map.size;
    },
  };
}

function createThrottle(minIntervalMs) {
  let last = 0;
  return async function wait() {
    const remaining = minIntervalMs - (Date.now() - last);
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
    last = Date.now();
  };
}

/** fetch com timeout — evita que uma API externa lenta/fora do ar
 *  deixe a requisição pendurada pra sempre. */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      const err = new Error(`Tempo esgotado ao chamar ${url}`);
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { createCache, createThrottle, fetchWithTimeout };
