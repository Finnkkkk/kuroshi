/**
 * Monta o app Express recebendo o provedor de dados como parâmetro —
 * assim dá pra testar as rotas com um provedor falso (veja test/app.test.js)
 * sem precisar de rede real nem depender de variável de ambiente.
 *
 * Quem escolhe QUAL provedor usar em produção é o src/server.js.
 */
const express = require("express");
const cors = require("cors");

const GENRE_PT_TO_EN = require("./genre-map");

function createApp(provider) {
  const app = express();

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

  return app;
}

module.exports = { createApp };
