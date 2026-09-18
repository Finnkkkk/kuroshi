# Kuroshi Backend

Backend Node.js/Express que serve de camada intermediária entre o front-end
do site e a **Jikan API** (wrapper gratuito e sem chave para o MyAnimeList),
exatamente como descrito na seção 1 e 2 do prompt original do projeto.

## Por que um backend, e não chamar a Jikan direto do front?

- **Rate limit**: a Jikan é gratuita mas tem limite de requisições. Esse
  servidor cacheia as respostas em memória por 10 minutos e enfileira as
  chamadas, então várias pessoas usando o site não estouram o limite.
- **Normalização**: a resposta da Jikan é convertida para o mesmo formato
  de objeto `anime` já usado no protótipo (`id, title, genres, rating,
  status, studio, eps, synopsis, cover...`), então o front-end não precisa
  saber nada sobre o formato da API externa.
- **Importante:** uma página publicada como Artifact do Claude roda numa
  sandbox que bloqueia chamadas de rede para domínios externos e imagens
  remotas — por isso este backend precisa ser hospedado por fora do Claude
  (na sua máquina, ou em algo como Render/Railway/Fly.io), e o front-end
  precisa ser servido a partir de onde esse backend está acessível.

## Como rodar localmente

```bash
cd backend
npm install
npm start
```

O servidor sobe em `http://localhost:4000`. Endpoints disponíveis:

| Endpoint | Descrição |
|---|---|
| `GET /api/top?page=1` | Ranking geral (para a rail "Em alta" da Home) |
| `GET /api/seasonal` | Anime da temporada atual (para "Lançamentos") |
| `GET /api/search?q=&genre=&status=&page=1` | Busca/catálogo com filtros |
| `GET /api/anime/:id` | Detalhes completos de um anime |
| `GET /api/anime/:id/episodes?page=1` | Lista de episódios (título, sem vídeo) |
| `GET /health` | Status simples + tamanho do cache |

Teste rápido:

```bash
curl "http://localhost:4000/api/top?page=1"
curl "http://localhost:4000/api/search?q=fullmetal"
```

## Como o front-end consumiria isso

No `anime-stream.html` do protótipo, a função que hoje lê o array
`ANIME` fixo seria trocada por chamadas assíncronas para este backend.
Exemplo de como ficaria a Home:

```js
async function loadHome() {
  const [topRes, seasonalRes] = await Promise.all([
    fetch("http://localhost:4000/api/top").then(r => r.json()),
    fetch("http://localhost:4000/api/seasonal").then(r => r.json()),
  ]);
  state.emAlta = topRes.results;
  state.lancamentos = seasonalRes.results;
  render();
}
```

Isso só funciona quando o HTML é servido fora do Artifact do Claude (por
exemplo, abrindo o arquivo localmente ou publicando em qualquer host
próprio) — dentro do preview do Claude, chamadas de rede para domínios
externos são bloqueadas por segurança.

## Sobre imagens de capa reais

O campo `cover` retorna a URL da capa oficial hospedada pelo MyAnimeList.
Isso é conteúdo licenciado dos estúdios/distribuidoras — ok para exibir via
link direto (é para isso que a Jikan disponibiliza o campo), mas **não deve
ser baixado e redistribuído** como parte do seu próprio site/app publicado.

## Vídeo dos episódios

Nenhuma API pública de metadados (Jikan, AniList, Kitsu) fornece vídeo real
— isso é esperado, já que os direitos de streaming pertencem aos estúdios
e distribuidoras. Para episódios reais, a única forma legítima é ter sua
própria licença de conteúdo e hospedar os vídeos (upload/CDN própria),
como o prompt original já previa. Evite integrar scrapers de sites como
GoGoAnime/AnimixPlay — além de ilegal na maioria das jurisdições, essas
fontes são instáveis e frequentemente saem do ar.

## Próximos passos sugeridos

- Adicionar Redis para cache compartilhado entre múltiplas instâncias
- Mapear nomes de gênero para os IDs numéricos da Jikan (endpoint
  `/genres/anime`) para filtrar direto na API em vez de após a resposta
- Adicionar autenticação (JWT) e rotas de usuário/favoritos/histórico
  com um banco de dados (PostgreSQL/MongoDB), como na seção 1 do prompt
