/**
 * Kuroshi Backend — ponto de entrada
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
 * A montagem das rotas fica em src/app.js (recebe o provedor como
 * parâmetro, o que permite testar com um provedor falso — veja
 * test/app.test.js). Este arquivo só escolhe o provedor real e sobe o
 * servidor HTTP.
 *
 * Nenhum provedor fornece vídeo real de episódio — isso é esperado, já
 * que os direitos de streaming pertencem aos estúdios/distribuidoras.
 * -----------------------------------------------------------------------
 */
const { createApp } = require("./app");
const jikan = require("./providers/jikan");
const anilist = require("./providers/anilist");

const PROVIDER_NAME = (process.env.PROVIDER || "jikan").toLowerCase();
const provider = PROVIDER_NAME === "anilist" ? anilist : jikan;

// Uma falha de rede ao chamar a API externa nunca deve derrubar o servidor.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (ignorado, servidor continua no ar):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (ignorado, servidor continua no ar):", err);
});

const app = createApp(provider);
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Kuroshi backend (provedor: ${provider.name}) rodando em http://localhost:${PORT}`);
  console.log(`Troque de provedor com a variável de ambiente PROVIDER=jikan|anilist`);
});
