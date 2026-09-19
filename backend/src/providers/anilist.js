/**
 * Provedor: AniList (https://anilist.co/graphql) — API GraphQL gratuita,
 * sem chave para leitura. Costuma ter dados mais completos que a Jikan
 * (banner de alta resolução, descrição mais longa), mas o rate limit
 * público é mais apertado, então o cache/throttle aqui é mais conservador.
 */
const { createCache, createThrottle, fetchWithTimeout } = require("../cache");

const ENDPOINT = "https://graphql.anilist.co";
const cache = createCache(10 * 60 * 1000);
const throttle = createThrottle(700);

const MEDIA_FIELDS = `
  id
  title { romaji english native }
  description(asHtml: false)
  genres
  averageScore
  status
  episodes
  seasonYear
  startDate { year }
  studios(isMain: true) { nodes { name } }
  coverImage { large medium }
  bannerImage
`;

function stripHtml(s) {
  return s ? s.replace(/<[^>]+>/g, "").trim() : "";
}

async function anilistQuery(query, variables) {
  const key = JSON.stringify({ query, variables });
  const cached = cache.get(key);
  if (cached) return cached;

  await throttle();
  const res = await fetchWithTimeout(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok || json.errors) {
    const msg = (json.errors && json.errors[0] && json.errors[0].message) || `AniList respondeu ${res.status}`;
    const err = new Error(msg);
    err.status = res.status >= 400 ? res.status : 502;
    throw err;
  }
  cache.set(key, json.data);
  return json.data;
}

function normalize(m) {
  return {
    id: String(m.id),
    title: (m.title && (m.title.english || m.title.romaji)) || "Sem título",
    alt: (m.title && (m.title.native || m.title.romaji)) || "",
    genres: m.genres || [],
    year: m.seasonYear || (m.startDate && m.startDate.year) || null,
    rating: m.averageScore ? Math.round(m.averageScore) / 10 : 0, // AniList usa 0–100
    status: m.status === "RELEASING" ? "em exibição" : "finalizado",
    studio: (m.studios && m.studios.nodes && m.studios.nodes[0] && m.studios.nodes[0].name) || "Desconhecido",
    eps: m.episodes || 0,
    synopsis: stripHtml(m.description),
    cover: (m.coverImage && (m.coverImage.large || m.coverImage.medium)) || null,
    banner: m.bannerImage || null,
    source: "anilist",
  };
}

function currentSeason() {
  const month = new Date().getUTCMonth() + 1;
  const year = new Date().getUTCFullYear();
  const season = month <= 3 ? "WINTER" : month <= 6 ? "SPRING" : month <= 9 ? "SUMMER" : "FALL";
  return { season, year };
}

async function top(page = 1) {
  const query = `query($page:Int){ Page(page:$page, perPage:24){ media(sort:POPULARITY_DESC, type:ANIME){ ${MEDIA_FIELDS} } } }`;
  const data = await anilistQuery(query, { page: Number(page) });
  return (data.Page.media || []).map(normalize);
}

async function seasonal() {
  const { season, year } = currentSeason();
  const query = `query($season:MediaSeason,$year:Int){ Page(perPage:24){ media(season:$season, seasonYear:$year, sort:POPULARITY_DESC, type:ANIME){ ${MEDIA_FIELDS} } } }`;
  const data = await anilistQuery(query, { season, year });
  return (data.Page.media || []).map(normalize);
}

async function search({ q = "", genreEn = "", status = "", page = 1 }) {
  const query = `query($page:Int,$q:String,$genre:String,$status:MediaStatus){
    Page(page:$page, perPage:24){
      pageInfo{ currentPage hasNextPage }
      media(search:$q, genre:$genre, status:$status, type:ANIME, sort:POPULARITY_DESC){ ${MEDIA_FIELDS} }
    }
  }`;
  const variables = {
    page: Number(page),
    q: q || undefined,
    genre: genreEn || undefined,
    status: status === "em exibição" ? "RELEASING" : status === "finalizado" ? "FINISHED" : undefined,
  };
  const data = await anilistQuery(query, variables);
  return { results: (data.Page.media || []).map(normalize), pagination: data.Page.pageInfo || null };
}

async function byId(id) {
  const query = `query($id:Int){ Media(id:$id, type:ANIME){ ${MEDIA_FIELDS} } }`;
  const data = await anilistQuery(query, { id: Number(id) });
  return data.Media ? normalize(data.Media) : null;
}

async function episodes(id) {
  // A AniList não expõe título por episódio de forma simples e gratuita
  // (isso vem de fontes como a AniDB, que exige registro de cliente).
  // Devolvemos uma lista numerada — o front-end já trata isso como
  // fallback normal, mostrando "Episódio N".
  const anime = await byId(id);
  const total = Math.max((anime && anime.eps) || 0, 1);
  return Array.from({ length: total }, (_, i) => ({ numero: i + 1, titulo: null }));
}

module.exports = { name: "anilist", top, seasonal, search, byId, episodes };
