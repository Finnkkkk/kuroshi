const request = require("supertest");
const { createApp } = require("../src/app");

/** Provedor falso — mesmo formato que jikan.js/anilist.js, sem tocar rede. */
function makeFakeProvider(overrides = {}) {
  const sampleAnime = {
    id: "20", title: "Naruto", alt: "ナルト", genres: ["Action", "Adventure"],
    year: 2002, rating: 7.9, status: "finalizado", studio: "Pierrot", eps: 220,
    synopsis: "ninja stuff", cover: "https://cdn.example/naruto.jpg", banner: null, source: "fake",
  };
  return {
    name: "fake",
    top: async () => [sampleAnime],
    seasonal: async () => [sampleAnime],
    search: async ({ genreEn }) => ({
      results: genreEn && genreEn !== "Action" ? [] : [sampleAnime],
      pagination: { currentPage: 1 },
    }),
    byId: async (id) => (id === "20" ? sampleAnime : null),
    episodes: async () => [{ numero: 1, titulo: "Enter: Naruto Uzumaki!" }],
    ...overrides,
  };
}

describe("GET /health", () => {
  it("responde ok com o nome do provedor ativo", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, provider: "fake" });
  });
});

describe("GET /api/top", () => {
  it("devolve os resultados normalizados do provedor", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/top");
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("fake");
    expect(res.body.results).toHaveLength(1);
    expect(res.body.results[0].title).toBe("Naruto");
  });

  it("devolve 500 com JSON de erro quando o provedor falha", async () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {}); // esperado: só limpa a saída
    const app = createApp(makeFakeProvider({ top: async () => { throw new Error("Jikan fora do ar"); } }));
    const res = await request(app).get("/api/top");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Jikan fora do ar");
    spy.mockRestore();
  });
});

describe("GET /api/search", () => {
  it("traduz o gênero em português antes de repassar ao provedor", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/search").query({ genre: "Ação" });
    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(1); // "Ação" -> "Action", que bate com o mock
  });

  it("filtra tudo quando o gênero não bate com nenhum resultado", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/search").query({ genre: "Romance" });
    expect(res.body.results).toHaveLength(0);
  });

  it("ignora o filtro de gênero quando é 'Todos'", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/search").query({ genre: "Todos" });
    expect(res.body.results).toHaveLength(1);
  });
});

describe("GET /api/anime/:id", () => {
  it("devolve o anime quando existe", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/anime/20");
    expect(res.status).toBe(200);
    expect(res.body.result.title).toBe("Naruto");
  });

  it("devolve 404 quando não existe", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/anime/999999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });
});

describe("GET /api/anime/:id/episodes", () => {
  it("devolve a lista de episódios do provedor", async () => {
    const app = createApp(makeFakeProvider());
    const res = await request(app).get("/api/anime/20/episodes");
    expect(res.status).toBe(200);
    expect(res.body.episodes[0].titulo).toBe("Enter: Naruto Uzumaki!");
  });
});
