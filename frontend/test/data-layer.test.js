/**
 * Teste "de lógica" do front-end — sem navegador, sem rede real.
 *
 * Extrai o <script> do index.html, executa num contexto isolado (vm) com
 * um `fetch` falso que devolve respostas no formato real da Jikan API, e
 * confere se DataSource/JikanDirect normalizam e roteiam os dados
 * corretamente nos modos "mock" e "jikan". As telas (render/view*) que
 * mexem em DOM não são exercitadas aqui — isso é coberto manualmente
 * abrindo o site num navegador.
 *
 * Rodar com: node test/data-layer.test.js
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf-8");
const match = html.match(/<script>([\s\S]*)<\/script>/);
if (!match) throw new Error("Não encontrei o <script> do index.html");

let js = match[1];
// remove só a chamada de topo `render();` do fim do arquivo (as chamadas
// internas dentro de go()/toggleFavorite() continuam intactas)
const lastRenderCall = js.lastIndexOf("render();");
js = js.slice(0, lastRenderCall) + "// render() removido para teste" + js.slice(lastRenderCall + "render();".length);
// `const`/`let` de topo não viram propriedades do objeto global do vm
// automaticamente (diferente de `var`/function) — expomos manualmente.
js += `
this.CONFIG = CONFIG;
this.DataSource = DataSource;
this.GENRE_PT_TO_EN = GENRE_PT_TO_EN;
this.cacheAnime = cacheAnime;
this.resolveAnime = resolveAnime;
this.ANIME = ANIME;
`;

const FIXTURES = {
  "/top/anime?page=1&filter=bypopularity": {
    data: [{
      mal_id: 5114, title: "Fullmetal Alchemist: Brotherhood", title_english: "Fullmetal Alchemist: Brotherhood",
      title_japanese: "鋼の錬金術師", genres: [{ name: "Action" }, { name: "Drama" }], year: 2009, score: 9.1,
      airing: false, studios: [{ name: "Bones" }], episodes: 64, synopsis: "sinopse teste",
      images: { jpg: { large_image_url: "https://cdn.example/fma.jpg" } }, trailer: { images: {} },
    }],
  },
  "/anime?limit=24&q=naruto": {
    data: [{
      mal_id: 20, title: "Naruto", title_english: "Naruto", title_japanese: "ナルト",
      genres: [{ name: "Action" }, { name: "Adventure" }], year: 2002, score: 7.9, airing: false,
      studios: [{ name: "Pierrot" }], episodes: 220, synopsis: "ninja stuff",
      images: { jpg: { large_image_url: "https://cdn.example/naruto.jpg" } }, trailer: { images: {} },
    }],
  },
  "/anime/20/full": {
    data: {
      mal_id: 20, title: "Naruto", title_english: "Naruto", title_japanese: "ナルト",
      genres: [{ name: "Action" }], year: 2002, score: 7.9, airing: false, studios: [{ name: "Pierrot" }],
      episodes: 220, synopsis: "ninja stuff", images: { jpg: { large_image_url: "https://cdn.example/naruto.jpg" } }, trailer: { images: {} },
    },
  },
  "/anime/20/episodes": {
    data: [{ mal_id: 1, title: "Enter: Naruto Uzumaki!" }, { mal_id: 2, title: "My Name is Konohamaru!" }],
  },
};

const fakeFetch = async (url) => {
  const path_ = url.replace("https://api.jikan.moe/v4", "");
  const fixture = FIXTURES[path_];
  return { ok: !!fixture, status: fixture ? 200 : 404, json: async () => fixture || { data: [] } };
};

const fakeLocalStorage = {
  _data: {},
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; },
};

const sandbox = { console, fetch: fakeFetch, localStorage: fakeLocalStorage, setTimeout, clearTimeout, Promise, URLSearchParams, AbortController };
vm.createContext(sandbox);
vm.runInContext(js, sandbox, { filename: "index.html#script" });

let failures = 0;
function check(label, cond) {
  try { assert.ok(cond); console.log("OK   - " + label); }
  catch (e) { console.log("FAIL - " + label); failures++; }
}

(async () => {
  // --- modo mock ---
  sandbox.CONFIG.DATA_SOURCE = "mock";
  const mockTop = await sandbox.DataSource.top();
  check("mock: top() devolve array não vazio", Array.isArray(mockTop) && mockTop.length > 0);
  check("mock: item tem campos essenciais", !!(mockTop[0].id && mockTop[0].title && mockTop[0].genres));

  // --- modo jikan (direto do navegador) ---
  sandbox.CONFIG.DATA_SOURCE = "jikan";
  const jikanTop = await sandbox.DataSource.top();
  check("jikan: top() usa a fixture e normaliza", jikanTop.length === 1 && jikanTop[0].title === "Fullmetal Alchemist: Brotherhood");
  check("jikan: rating numérico correto", jikanTop[0].rating === 9.1);
  check("jikan: genres vira array de strings", jikanTop[0].genres.join(",") === "Action,Drama");
  check("jikan: status normalizado pra português", jikanTop[0].status === "finalizado");
  check("jikan: cover mapeado da resposta da API", jikanTop[0].cover === "https://cdn.example/fma.jpg");

  const searchRes = await sandbox.DataSource.search({ q: "naruto", genre: "Todos", status: "Todos" });
  check("jikan: search() encontra o resultado certo", searchRes.length === 1 && searchRes[0].title === "Naruto");

  const byId = await sandbox.DataSource.byId("20");
  check("jikan: byId() normaliza corretamente", !!byId && byId.title === "Naruto" && byId.id === "20");

  const eps = await sandbox.DataSource.episodes(byId);
  check("jikan: episodes() traz títulos reais quando a API tem", eps.length === 2 && eps[0].titulo === "Enter: Naruto Uzumaki!");

  const eps404 = await sandbox.DataSource.episodes({ id: "999999", eps: 3 });
  check("jikan: episodes() cai no fallback numerado se a API falhar", eps404.length === 3 && eps404[0].titulo === null);

  check("GENRE_PT_TO_EN traduz 'Ação' -> 'Action'", sandbox.GENRE_PT_TO_EN["Ação"] === "Action");

  sandbox.cacheAnime(byId);
  check("cacheAnime + resolveAnime funcionam com anime vindo da API", sandbox.resolveAnime("20").title === "Naruto");

  console.log("\n" + (failures === 0 ? "Todos os testes passaram." : `${failures} teste(s) falharam.`));
  process.exit(failures === 0 ? 0 : 1);
})();
