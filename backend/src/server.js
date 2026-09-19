/**
 * Kuroshi Backend
 * -----------------------------------------------------------------------
 * Camada intermediária entre o front-end e uma API pública de anime.
 * Suporta dois provedores — troque com a variável de ambiente PROVIDER:
 *
 *   PROVIDER=jikan     (padrão) — https://jikan.moe, wrapper do MyAnimeList
 *   PROVIDER=anilist   — https://anilist.co/graphql, dados mais completos
 *
 * As duas foram escolhidas entre as opções listadas em publicapis.dev/
 * category/anime por serem gratuitas, sem necessidade de chave/OAuth,
 * e por devolverem catálogo geral (título, sinopse, gêneros, nota,
 * episódios) — ao contrário da maioria das outras da lista, que são
 * específicas de uma franquia (Dattebayo/Naruto, Dragon Ball), de manga
 * (MangaDex), de imagens aleatórias sem metadados de catálogo (Waifu.im,
 * Nekos API, NekosBest, Danbooru) ou exigem registro mais pesado
 * (MyAnimeList oficial via OAuth, AniDB via cliente UDP registrado).
 *
 * O restante do projeto (front-end, rotas, formato de resposta) não muda
 * nada ao trocar de provedor — os dois são normalizados pro mesmo formato
 * de objeto `anime` em src/providers/*.js.
 *
 * Nenhum provedor fornece vídeo real de episódio — isso é esperado, já
 * que os direitos de streaming pertencem aos estúdios/distribuidoras.
 * -----------------------------------------------------------------------
 */

const express = require("express");
const cors = require("cors");

const jikan = require("./providers/jikan");
const anilist = require("./providers/anilist");
const GENRE_PT_TO_EN = require("./genre-map");

const PROVIDER_NAME = (process.env.PROVIDER || "jikan").toLowerCase();
const provider = PROVIDER_NAME === "anilist" ? anilist : jikan;

// Uma falha de rede ao chamar a API externa nunca deve derrubar o servidor.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (ignorado, servidor continua no ar):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (ignorado, servidor continua no ar):", err);
});

const app = express();
const PORT = process.env.PORT || 4000;

// CORS aberto para facilitar desenvolvimento local e o GitHub Pages;
// para produção, restrinja ao seu domínio (veja README.md deste backend).
app.use(cors());
app.use(express.json());

function handleError(res, e) {
  console.error(e);
  res.status(e.status || 500).json({ error: e.message || "Erro interno" });
}

// GET /api/top?page=1  -> ranking geral (para a Home: "Em alta")
app.get("/api/top", async (req, res) => {
  try {
    const results = await provider.top(req.query.page || 1);
    res.json({ provider: provider.name, results });
  } catch (e) {
    handleError(res, e);
  }
});

// GET /api/seasonal -> temporada atual (para "Lançamentos")
app.get("/api/seasonal", async (req, res) => {
  try {
    const results = await provider.seasonal();
    res.json({ provider: provider.name, results });
  } catch (e) {
    handleError(res, e);
  }
});

// GET /api/search?q=termo&genre=&status=&page=1 -> catálogo/busca
// (genre vem em português do front-end — ex: "Ação" — e é traduzido aqui)
app.get("/api/search", async (req, res) => {
  try {
    const { q = "", genre = "", status = "", page = 1 } = req.query;
    const genreEn = genre && genre !== "Todos" ? GENRE_PT_TO_EN[genre] || "" : "";
    const { results, pagination } = await provider.search({ q, genreEn, status, page });
    res.json({ provider: provider.name, results, pagination });
  } catch (e) {
    handleError(res, e);
  }
});

// GET /api/anime/:id -> detalhes completos de um anime
app.get("/api/anime/:id", async (req, res) => {
  try {
    const result = await provider.byId(req.params.id);
    if (!result) return res.status(404).json({ error: "Anime não encontrado" });
    res.json({ provider: provider.name, result });
  } catch (e) {
    handleError(res, e);
  }
});

// GET /api/anime/:id/episodes?page=1 -> lista de episódios (número/título,
// nunca vídeo — nenhuma API pública de metadados fornece isso)
app.get("/api/anime/:id/episodes", async (req, res) => {
  try {
    const episodes = await provider.episodes(req.params.id, req.query.page || 1);
    res.json({ provider: provider.name, episodes });
  } catch (e) {
    handleError(res, e);
  }
});

app.get("/health", (req, res) => res.json({ ok: true, provider: provider.name }));

app.listen(PORT, () => {
  console.log(`Kuroshi backend (provedor: ${provider.name}) rodando em http://localhost:${PORT}`);
  console.log(`Troque de provedor com a variável de ambiente PROVIDER=jikan|anilist`);
});
