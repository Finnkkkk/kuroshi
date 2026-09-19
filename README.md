# Kuroshi — Streaming de Anime (protótipo)

Protótipo de site de streaming de anime inspirado visualmente na
Crunchyroll/Punishing Gray Raven, construído como projeto de portfólio.

> ⚠️ **Aviso:** este é um projeto de estudo/portfólio. Não distribui
> vídeos reais de anime (sem licença para isso), não tem afiliação com
> nenhum serviço de streaming e todo o catálogo de exemplo é fictício.

## 🔗 Site publicado

Depois do primeiro push para `main`, o GitHub Actions publica automaticamente
o conteúdo de `frontend/` no GitHub Pages, em:

```
https://SEU_USUARIO.github.io/kuroshi/
```

**Configuração única, feita uma vez pelo dono do repositório:** em
`Settings → Pages → Build and deployment → Source`, escolha
**"GitHub Actions"**. Depois disso, todo `git push` na branch `main` que
tocar em `frontend/` já republica o site sozinho (veja
`.github/workflows/deploy-pages.yml`).

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | HTML + CSS + JavaScript puro (sem build step) |
| Backend | Node.js + Express |
| Fonte de dados | [Jikan](https://jikan.moe) (padrão) ou [AniList](https://anilist.co/graphql) — troca por variável de ambiente, veja `backend/README.md` |
| Cache | Em memória (Map com TTL) — trocar por Redis para produção |

## Estrutura do repositório

```
kuroshi/
├── .github/workflows/
│   └── deploy-pages.yml     # publica frontend/ no GitHub Pages a cada push
├── frontend/
│   └── index.html            # site completo (SPA em JS puro, autocontido)
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── README.md              # detalhes de cada endpoint + comparação de APIs
│   └── src/
│       ├── server.js           # rotas Express, escolhe o provedor por env var
│       ├── cache.js             # cache com TTL + throttle + fetch com timeout
│       ├── genre-map.js         # gêneros PT-BR -> EN
│       └── providers/
│           ├── jikan.js          # provedor Jikan/MyAnimeList
│           └── anilist.js        # provedor AniList (GraphQL)
├── .gitignore
├── LICENSE
└── README.md                   # este arquivo
```

## Como rodar localmente

### 1. Backend (dados reais de anime — opcional)

```bash
cd backend
npm install
npm start
```

Sobe em `http://localhost:4000`. Veja `backend/README.md` para a lista
completa de endpoints (`/api/top`, `/api/search`, `/api/anime/:id`, etc).
O front-end funciona sem isso — só é necessário se você quiser dados reais
em vez do catálogo fictício (veja a seção seguinte).

### 2. Front-end

O `frontend/index.html` é autocontido (não precisa de build). Para rodar
localmente:

```bash
cd frontend
npx serve .
# ou simplesmente abra o index.html direto no navegador
```

## 🔌 Como plugar uma API de anime de verdade

Todo o acesso a dados do site passa por um único objeto, no topo do
`<script>` de `frontend/index.html`:

```js
const CONFIG = {
  DATA_SOURCE: "mock",              // troque para "api"
  API_BASE_URL: "http://localhost:4000"   // ou a URL do seu backend hospedado
};
```

Com `DATA_SOURCE: "api"`, toda a Home, o catálogo, a busca, a página de
detalhes e o player passam a buscar dados reais (título, sinopse, nota,
gêneros, capa) através do backend deste repositório — nenhum outro trecho
de código precisa mudar, porque as telas sempre conversam com o objeto
`DataSource`, nunca diretamente com `fetch`.

O backend, por sua vez, pode usar a **Jikan** ou a **AniList** como fonte
real dos dados (troca por variável de ambiente `PROVIDER`, veja
`backend/README.md`) — o front-end nem precisa saber qual das duas está
por trás.

**Importante:** o GitHub Pages só hospeda arquivos estáticos — ele não roda
o backend Node. Pra usar `DATA_SOURCE: "api"` no site publicado, você
precisa hospedar a pasta `backend/` em algo como Render, Railway ou Fly.io
e apontar `API_BASE_URL` pra URL pública desse serviço.

## Sobre o login

O cadastro/login valida e-mail e senha de verdade contra contas já criadas
— mas tudo fica salvo no `localStorage` do próprio navegador, sem um
servidor de autenticação por trás. É o suficiente pra demonstrar o fluxo
completo (cadastro → validação de e-mail duplicado → login → senha
incorreta → sessão persistida → logout), mas **não use senhas reais nele**.
Autenticação de verdade (JWT + banco de dados) está no roadmap abaixo.

## Funcionalidades já implementadas

- Home com destaque, carrosséis (Em alta, Lançamentos, Continuar assistindo, Recomendados)
- Catálogo com busca, filtro por gênero/status e ordenação
- Página de detalhes do anime com sinopse, metadados e lista de episódios
- Player customizado (play/pause, seek, próximo episódio com autoplay)
- Perfil (histórico, favoritos, configurações) persistido em `localStorage`
- Login/cadastro com validação (local, sem backend de autenticação ainda)
- Backend Express com proxy + cache para APIs de anime (Jikan ou AniList, trocável por variável de ambiente)
- Camada de dados única (`DataSource`) que alterna entre catálogo fictício e API real com uma linha de configuração
- Deploy automático do front-end no GitHub Pages via GitHub Actions

## Roadmap (do prompt original do projeto)

- [ ] Autenticação real (JWT) + login social de verdade
- [ ] Banco de dados (PostgreSQL/MongoDB) para usuários, favoritos e histórico
- [ ] Player com HLS real (video.js/hls.js) quando houver fonte de vídeo própria
- [ ] Sistema de comentários por episódio
- [ ] Notificações de novos episódios
- [ ] Painel admin para catálogo próprio
- [ ] Testes (Jest) nas rotas do backend
- [ ] Deploy do backend (Railway/Render/Fly.io)

## Licença

MIT — veja [`LICENSE`](./LICENSE). O catálogo de exemplo é fictício;
dados reais consumidos via Jikan seguem os termos do MyAnimeList.
