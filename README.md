# Kuroshi — Streaming de Anime (protótipo)

Protótipo de site de streaming de anime inspirado visualmente na
Crunchyroll/Punishing Gray Raven, construído como projeto de portfólio.

> ⚠️ **Aviso:** este é um projeto de estudo/portfólio. Não distribui
> vídeos reais de anime (sem licença para isso), não tem afiliação com
> nenhum serviço de streaming, e o login é uma simulação local (sem
> servidor de autenticação real). Só o **catálogo** de anime é de verdade.

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

**O site já sobe com catálogo real** (título, sinopse, nota, gêneros,
capa) direto da Jikan API, chamada pelo próprio navegador — não precisa
rodar nem hospedar nenhum backend pra isso. Veja "Fontes de dados" abaixo
para os detalhes e outras opções.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | HTML + CSS + JavaScript puro (sem build step) |
| Backend (opcional) | Node.js + Express |
| Fontes de dados | [Jikan](https://jikan.moe) direto do navegador (padrão) · [Jikan](https://jikan.moe) ou [AniList](https://anilist.co/graphql) via backend próprio |
| Testes | Jest + Supertest (backend) · script Node com `vm` (front-end) |
| Cache | Em memória (Map com TTL) — trocar por Redis para produção |

## Estrutura do repositório

```
kuroshi/
├── .github/workflows/
│   └── deploy-pages.yml     # publica frontend/ no GitHub Pages a cada push
├── frontend/
│   ├── index.html            # site completo (SPA em JS puro, autocontido)
│   └── test/
│       └── data-layer.test.js # testa a camada de dados sem navegador/rede real
├── backend/                   # opcional — só se você quiser rodar seu próprio proxy
│   ├── package.json
│   ├── .env.example
│   ├── README.md               # detalhes de cada endpoint + comparação de APIs
│   ├── src/
│   │   ├── app.js               # monta as rotas Express (testável)
│   │   ├── server.js            # ponto de entrada: escolhe provedor + sobe o servidor
│   │   ├── cache.js              # cache com TTL + throttle + fetch com timeout
│   │   ├── genre-map.js          # gêneros PT-BR -> EN
│   │   └── providers/
│   │       ├── jikan.js           # provedor Jikan/MyAnimeList
│   │       └── anilist.js         # provedor AniList (GraphQL)
│   └── test/
│       └── app.test.js          # testes das rotas com provedor falso
├── render.yaml                 # deploy em 1 clique do backend no Render (opcional)
├── .gitignore
├── LICENSE
└── README.md                    # este arquivo
```

## Fontes de dados — três modos

Todo acesso a dados do site passa por um único objeto (`DataSource`), no
topo do `<script>` de `frontend/index.html`:

```js
const CONFIG = {
  DATA_SOURCE: "jikan",  // "mock" | "jikan" | "backend"  ← já vem assim
  API_BASE_URL: "http://localhost:4000" // só usado no modo "backend"
};
```

| Modo | Como funciona | Quando usar |
|---|---|---|
| `"jikan"` **(padrão)** | O navegador chama `api.jikan.moe` direto — a Jikan libera CORS para qualquer site | Site publicado no GitHub Pages — funciona sozinho, sem backend |
| `"backend"` | O navegador chama o backend deste repo (pasta `/backend`), que por sua vez usa Jikan **ou** AniList | Quando você quer rodar/hospedar seu próprio backend (ex: pra usar AniList, ou adicionar cache/rotas próprias) |
| `"mock"` | Catálogo fictício embutido, sem nenhuma chamada de rede | Desenvolvimento offline, ou dentro de ambientes que bloqueiam chamadas externas |

Nenhuma tela (Home, catálogo, detalhes, player) muda ao trocar de modo —
todas conversam só com `DataSource`, nunca com `fetch` diretamente.

**Importante:** GitHub Pages só hospeda arquivos estáticos, não roda
Node — por isso o modo `"backend"` só funciona se você hospedar a pasta
`/backend` em outro lugar (veja `render.yaml` e `backend/README.md`).

## Como rodar localmente

### Front-end (funciona sozinho, com dados reais)

```bash
cd frontend
npx serve .
# ou simplesmente abra o index.html direto no navegador
```

Como `DATA_SOURCE` já vem como `"jikan"`, isso já mostra catálogo real
sem precisar de mais nada.

### Backend (opcional — só se quiser trocar pra AniList ou hospedar seu próprio proxy)

```bash
cd backend
npm install
npm start                  # usa Jikan por padrão
# ou: PROVIDER=anilist npm start
```

Depois, mude `DATA_SOURCE` para `"backend"` no `frontend/index.html`.
Veja `backend/README.md` para a lista completa de endpoints.

## Testes

```bash
# front-end — testa a camada de dados (mock + jikan) sem navegador nem rede real
cd frontend && node test/data-layer.test.js

# backend — testa as rotas Express com um provedor falso
cd backend && npm test
```

## Deploy do backend (opcional)

Só é necessário se você quiser usar o modo `"backend"` (por exemplo, pra
usar o provedor AniList). O `render.yaml` na raiz do repositório já
deixa isso em um clique: no [Render](https://render.com), escolha
**New + → Blueprint** e aponte pro seu repositório.

## Sobre o login

O cadastro/login valida e-mail e senha de verdade contra contas já criadas
— mas tudo fica salvo no `localStorage` do próprio navegador, sem um
servidor de autenticação por trás. É o suficiente pra demonstrar o fluxo
completo (cadastro → validação de e-mail duplicado → login → senha
incorreta → sessão persistida → logout), mas **não use senhas reais nele**.
Autenticação de verdade (JWT + banco de dados) está no roadmap abaixo.

## Funcionalidades já implementadas

- Catálogo real de anime (Jikan, direto do navegador) — título, sinopse, nota, gêneros, capa
- Hero com fundo desfocado + capa nítida (sem depender do banner de trailer da Jikan, que costuma faltar ou vir em baixa resolução) e ficha técnica (ano, episódios, estúdio, status) no lugar de miniaturas falsas
- Home com destaque, carrosséis (Em alta, Lançamentos, Continuar assistindo, Recomendados)
- Catálogo com busca, filtro por gênero/status e ordenação
- Página de detalhes do anime com sinopse, metadados e lista de episódios (com título real, quando disponível)
- Player customizado (play/pause, seek, próximo episódio com autoplay), com lista de episódios real (não trava mais em animes com contagem de episódios ainda desconhecida, como os em exibição)
- Carregamento dos 3 carrosséis da Home em paralelo de verdade (antes ficavam um esperando o outro terminar), com cache em `localStorage` pra visitas seguintes serem instantâneas, e skeleton com shimmer enquanto carrega
- Responsivo (mobile/tablet/desktop), com safe-area pro notch/status bar do iOS
- Perfil (histórico, favoritos, configurações) persistido em `localStorage`, funciona com anime de qualquer fonte de dados
- Login/cadastro com validação (local, sem backend de autenticação ainda)
- Backend opcional com proxy + cache para Jikan ou AniList, trocável por variável de ambiente
- Testes automatizados no front-end (camada de dados) e no backend (rotas)
- Deploy automático do front-end no GitHub Pages via GitHub Actions
- Deploy em 1 clique do backend opcional via `render.yaml`

## Roadmap (do prompt original do projeto)

- [ ] Autenticação real (JWT) + login social de verdade
- [ ] Banco de dados (PostgreSQL/MongoDB) para usuários, favoritos e histórico
- [ ] Player com HLS real (video.js/hls.js) quando houver fonte de vídeo própria
- [ ] Sistema de comentários por episódio
- [ ] Notificações de novos episódios
- [ ] Painel admin para catálogo próprio

## Licença

MIT — veja [`LICENSE`](./LICENSE). O catálogo de exemplo é fictício;
dados reais consumidos via Jikan/AniList seguem os termos de cada serviço.
