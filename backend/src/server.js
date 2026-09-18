/**
 * Kuroshi Backend
 * -----------------------------------------------------------------------
 * Camada intermediária entre o front-end e a Jikan API (wrapper não-oficial
 * do MyAnimeList — https://jikan.moe). Isso resolve três problemas:
 *
 *  1. CORS/robustez: o front-end chama SEMPRE o nosso próprio domínio,
 *     nunca a API externa diretamente.
 *  2. Rate limit: a Jikan tem limite de requisições por segundo/minuto.
 *     Cacheamos as respostas em memória para não estourar esse limite.
 *  3. Formato: normalizamos a resposta da Jikan para o formato que o
 *     front-end do Kuroshi já espera (mesmos campos usados no protótipo).
 *
 * Não fornece vídeo de episódio real — a Jikan não tem isso (por direitos
 * autorais). Os campos de vídeo continuam como placeholder, como já
 * estava previsto no prompt original do projeto.
 * -----------------------------------------------------------------------
 */

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

const JIKAN_BASE = "https://api.jikan.moe/v4";

// ---------------------------------------------------------------------
// Cache simples em memória (troque por Redis em produção, como sugere
// a seção 2 do prompt original, se for escalar além de um processo)
// ---------------------------------------------------------------------
const cache = new Map();
const TTL_MS = 10 * 60 * 1000; // 10 minutos

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}
function setCached(key, value) {
  cache.set(key, { value, time: Date.now() });
}

// ---------------------------------------------------------------------
// Fila simples para respeitar o rate limit público da Jikan
// (~3 requisições/segundo, 60/minuto)
// ---------------------------------------------------------------------
let lastCall = 0;
const MIN_INTERVAL_MS = 400;

async function jikanFetch(path) {
  const cached = getCached(path);
  if (cached) return cached;

  const wait = Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const res = await fetch(`${JIKAN_BASE}${path}`);
  if (!res.ok) {
    const err = new Error(`Jikan respondeu ${res.status} para ${path}`);
    err.status = res.status;
    throw err;
  }
  const json = await res.json();
  setCached(path, json);
  return json;
}

// ---------------------------------------------------------------------
// Normalização: converte o formato da Jikan para o formato usado pelo
// front-end do Kuroshi (mesma forma dos objetos do array ANIME mockado)
// ---------------------------------------------------------------------
function normalizeAnime(a) {
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
    cover: a.images && a.images.jpg && a.images.jpg.large_image_url,
    banner: a.trailer && a.trailer.images && a.trailer.images.maximum_image_url,
    source: "jikan/myanimelist",
  };
}

app.use(cors());
app.use(express.json());

// GET /api/top?page=1  -> ranking geral (para a Home: "Em alta")
app.get("/api/top", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const data = await jikanFetch(`/top/anime?page=${page}&filter=bypopularity`);
    res.json({ results: (data.data || []).map(normalizeAnime) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /api/seasonal -> temporada atual (para "Lançamentos")
app.get("/api/seasonal", async (req, res) => {
  try {
    const data = await jikanFetch(`/seasons/now`);
    res.json({ results: (data.data || []).map(normalizeAnime) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /api/search?q=termo&genre=&status=&page=1 -> catálogo/busca
app.get("/api/search", async (req, res) => {
  try {
    const { q = "", genre = "", status = "", page = 1 } = req.query;
    const params = new URLSearchParams({ page: String(page), limit: "24" });
    if (q) params.set("q", q);
    if (status === "em exibição") params.set("status", "airing");
    if (status === "finalizado") params.set("status", "complete");
    // Jikan usa IDs numéricos de gênero; para simplificar, filtramos por
    // nome depois de buscar (uma otimização futura seria mapear
    // nome -> id usando GET /genres/anime e cachear esse mapa).
    const data = await jikanFetch(`/anime?${params.toString()}`);
    let results = (data.data || []).map(normalizeAnime);
    if (genre && genre !== "Todos") {
      results = results.filter((a) => a.genres.includes(genre));
    }
    res.json({ results, pagination: data.pagination || null });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /api/anime/:id -> detalhes completos de um anime
app.get("/api/anime/:id", async (req, res) => {
  try {
    const data = await jikanFetch(`/anime/${req.params.id}/full`);
    res.json({ result: normalizeAnime(data.data) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET /api/anime/:id/episodes?page=1 -> lista de episódios (título/duração,
// nunca vídeo — a Jikan não fornece isso)
app.get("/api/anime/:id/episodes", async (req, res) => {
  try {
    const page = req.query.page || 1;
    const data = await jikanFetch(`/anime/${req.params.id}/episodes?page=${page}`);
    const episodes = (data.data || []).map((e) => ({
      numero: e.mal_id,
      titulo: e.title,
      duracao: null, // a Jikan não retorna duração por episódio
      video_url: null, // placeholder — precisa vir de uma fonte própria/CDN
      thumbnail: null,
    }));
    res.json({ episodes, pagination: data.pagination || null });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true, cacheSize: cache.size }));

app.listen(PORT, () => {
  console.log(`Kuroshi backend rodando em http://localhost:${PORT}`);
  console.log(`Endpoints: /api/top  /api/seasonal  /api/search  /api/anime/:id  /api/anime/:id/episodes`);
});
