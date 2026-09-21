/**
 * Provedor: Jikan API (https://jikan.moe) — wrapper gratuito e sem chave
 * do MyAnimeList. Rate limit público (~3 req/s, 60/min), por isso cacheamos
 * e enfileiramos as chamadas.
 */
const { createCache, createThrottle, fetchWithTimeout } = require("../cache");

const BASE = "https://api.jikan.moe/v4";
const cache = createCache(10 * 60 * 1000); // 10 minutos
const throttle = createThrottle(400);

async function jikanFetch(path) {
  const cached = cache.get(path);
  if (cached) return cached;

  await throttle();
  const res = await fetchWithTimeout(`${BASE}${path}`);
  if (!res.ok) {
    const err = new Error(`Jikan respondeu ${res.status} para ${path}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  cache.set(path, json);
  return json;
}

function normalize(a) {
  return {
    id: String(a.mal_id),
    title: a.title_english || a.title,
    alt: a.title_japanese || a.title,
    genres: (a.genres || []).map((g) => g.name),
    year: a.year || (a.aired && a.aired.prop && a.aired.prop.from && a.aired.prop.from.year) || null,
    rating: a.score || 0,
    status: a.airing ? "em exibição" : "finalizado",
    studio: (a.studios && a.studios[0] && a.studios[0].name) || "Desconhecido",
    eps: a.episodes || 0,
    synopsis: a.synopsis || "",
    cover: (a.images && a.images.jpg && a.images.jpg.large_image_url) || null,
    banner: (a.trailer && a.trailer.images && a.trailer.images.maximum_image_url) || null,
    source: "jikan",
  };
}

async function top(page = 1) {
  const data = await jikanFetch(`/top/anime?page=${page}&filter=bypopularity`);
  return (data.data || []).map(normalize);
}

async function seasonal() {
  const data = await jikanFetch(`/seasons/now`);
  return (data.data || []).map(normalize);
}

async function search({ q = "", genreEn = "", status = "", page = 1 }) {
  const params = new URLSearchParams({ page: String(page), limit: "24" });
  if (q) params.set("q", q);
  if (status === "em exibição") params.set("status", "airing");
  if (status === "finalizado") params.set("status", "complete");

  const data = await jikanFetch(`/anime?${params.toString()}`);
  let results = (data.data || []).map(normalize);
  // A Jikan filtra gênero por ID numérico; pra manter simples, filtramos
  // pelo nome já normalizado depois de buscar.
  if (genreEn) results = results.filter((a) => a.genres.includes(genreEn));
  return { results, pagination: data.pagination || null };
}

async function byId(id) {
  const data = await jikanFetch(`/anime/${id}/full`);
  return data.data ? normalize(data.data) : null;
}

async function episodes(id, page = 1) {
  const data = await jikanFetch(`/anime/${id}/episodes?page=${page}`);
  return (data.data || []).map((e) => ({ numero: e.mal_id, titulo: e.title || null }));
}

module.exports = { name: "jikan", top, seasonal, search, byId, episodes };
