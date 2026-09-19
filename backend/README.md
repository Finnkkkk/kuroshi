# Kuroshi Backend

Backend Node.js/Express que serve de camada intermediária entre o front-end
do site e uma API pública de anime, exatamente como descrito na seção 1 e 2
do prompt original do projeto.

## Provedores disponíveis

Avaliei as APIs listadas em [publicapis.dev/category/anime](https://publicapis.dev/category/anime)
e implementei as duas que realmente servem como catálogo geral, gratuitas
e sem necessidade de chave/OAuth:

| Provedor | `PROVIDER=` | Pontos fortes | Limitações |
|---|---|---|---|
| **Jikan** (MyAnimeList) | `jikan` (padrão) | Sem chave, bem documentada, episódios com título individual | Rate limit público mais apertado |
| **AniList** | `anilist` | GraphQL, sinopse mais longa, banner em alta resolução | Não expõe título por episódio (mostra "Episódio N") |

Troque de provedor só com uma variável de ambiente — nenhum outro código
muda, porque as duas são normalizadas pro mesmo formato de objeto `anime`
em `src/providers/*.js`:

```bash
PROVIDER=anilist npm start
```

### Por que as outras da lista ficaram de fora

- **AniDB** — precisa de registro de cliente e usa protocolo UDP, não dá
  pra consumir com um `fetch` simples.
- **MyAnimeList oficial** — exige criar um app e autenticação OAuth; a
  Jikan já entrega os mesmos dados sem essa fricção.
- **Kitsu** — funciona, mas o rate limit gratuito (100 req/hora) é baixo
  demais pra um site com vários visitantes, mesmo com cache.
- **Shikimori** — funcional, porém menos padronizada/documentada que as
  outras duas.
- **Dattebayo API, Dragon Ball API** — catálogo de uma única franquia,
  não servem pra um catálogo geral de animes.
- **MangaDex, Mangapi** — são de mangá, não de anime.
- **Nekos API, NekosBest, Nekosia API, Waifu.im, Danbooru** — devolvem
  imagens aleatórias sem metadados de catálogo (e sem garantia de
  conteúdo apropriado).
- **Trace Moe** — identifica a cena de um anime a partir de um screenshot;
  interessante como funcionalidade extra futura, mas não é uma fonte de
  catálogo.
- **AnimeNewsNetwork** — é notícia sobre a indústria, não catálogo.

## Por que um backend, e não chamar a API direto do front?

- **Rate limit**: cacheamos as respostas em memória por 10 minutos e
  enfileiramos as chamadas, então vários visitantes do site não estouram
  o limite da API externa.
- **Normalização**: a resposta de qualquer provedor é convertida pro
  mesmo formato de objeto `anime` (`id, title, genres, rating, status,
  studio, eps, synopsis, cover, banner...`) — o front-end não precisa
  saber qual API está por trás.
- **Importante:** uma página publicada como Artifact do Claude roda numa
  sandbox que bloqueia chamadas de rede para domínios externos e imagens
  remotas — por isso este backend precisa ser hospedado por fora do Claude
  (na sua máquina, ou em algo como Render/Railway/Fly.io), e o front-end
  precisa ser servido a partir de onde esse backend está acessível.

## Estrutura

```
backend/
├── package.json
├── .env.example
└── src/
    ├── server.js            # rotas Express, escolhe o provedor por env var
    ├── cache.js              # cache com TTL + throttle + fetch com timeout
    ├── genre-map.js          # gêneros PT-BR (front) -> EN (APIs)
    └── providers/
        ├── jikan.js           # implementação usando a Jikan API
        └── anilist.js         # implementação usando a AniList GraphQL
```

## Como rodar localmente

```bash
cd backend
npm install
npm start                  # usa Jikan por padrão
# ou
PROVIDER=anilist npm start # usa AniList
```

O servidor sobe em `http://localhost:4000`. Endpoints disponíveis (iguais
nos dois provedores):

| Endpoint | Descrição |
|---|---|
| `GET /api/top?page=1` | Ranking geral (para a rail "Em alta" da Home) |
| `GET /api/seasonal` | Anime da temporada atual (para "Lançamentos") |
| `GET /api/search?q=&genre=&status=&page=1` | Busca/catálogo com filtros |
| `GET /api/anime/:id` | Detalhes completos de um anime |
| `GET /api/anime/:id/episodes?page=1` | Lista de episódios (número/título, sem vídeo) |
| `GET /health` | Status simples + qual provedor está ativo |

Teste rápido:

```bash
curl "http://localhost:4000/api/top?page=1"
curl "http://localhost:4000/api/search?q=fullmetal"
curl "http://localhost:4000/health"
```

Cada chamada externa tem timeout de 8 segundos e qualquer erro de rede
volta como um JSON `{ "error": "..." }` com o status HTTP apropriado —
o servidor nunca cai por causa de uma API externa fora do ar.

## Como o front-end consumiria isso

O `frontend/index.html` já vem pronto pra isso — é só mudar duas linhas
no topo do `<script>`:

```js
const CONFIG = {
  DATA_SOURCE: "api",                      // era "mock"
  API_BASE_URL: "https://seu-backend.onrender.com" // ou http://localhost:4000
};
```

Todas as telas (Home, catálogo, detalhes, player) usam um único objeto
`DataSource` internamente, então essa é a única mudança necessária — e o
front-end nem sabe se por trás está a Jikan ou a AniList.

Isso só funciona quando o HTML é servido fora do Artifact do Claude (por
exemplo, publicado no GitHub Pages, ou aberto localmente) — dentro do
preview do Claude, chamadas de rede para domínios externos são bloqueadas
por segurança.

**Nota sobre CORS:** o `server.js` usa `cors()` sem restrição (`origin: *`)
pra facilitar o desenvolvimento local. Se for expor o backend publicamente,
restrinja para o domínio do seu GitHub Pages:

```js
app.use(cors({ origin: "https://SEU_USUARIO.github.io" }));
```

## Sobre imagens de capa reais

Os campos `cover`/`banner` retornam a URL da capa/banner oficial hospedada
pelo MyAnimeList ou pela AniList. É conteúdo licenciado dos
estúdios/distribuidoras — ok para exibir via link direto (é pra isso que
essas APIs disponibilizam o campo), mas **não deve ser baixado e
redistribuído** como parte do seu próprio site/app publicado.

## Vídeo dos episódios

Nenhuma API pública de metadados (Jikan, AniList, Kitsu, Shikimori...)
fornece vídeo real — isso é esperado, já que os direitos de streaming
pertencem aos estúdios e distribuidoras. Para episódios reais, a única
forma legítima é ter sua própria licença de conteúdo e hospedar os vídeos
(upload/CDN própria), como o prompt original já previa. Evite integrar
scrapers de sites como GoGoAnime/AnimixPlay — além de ilegal na maioria
das jurisdições, essas fontes são instáveis e frequentemente saem do ar.

## Próximos passos sugeridos

- Adicionar Redis para cache compartilhado entre múltiplas instâncias
- Mapear nomes de gênero para os IDs numéricos da Jikan (endpoint
  `/genres/anime`) para filtrar direto na API em vez de após a resposta
- Adicionar autenticação (JWT) e rotas de usuário/favoritos/histórico
  com um banco de dados (PostgreSQL/MongoDB), como na seção 1 do prompt
- Combinar os dois provedores (ex: título/sinopse da AniList + episódios
  nomeados da Jikan) quando o `mal_id` e o `id` da AniList coincidirem
