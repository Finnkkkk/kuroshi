# Kuroshi — Streaming de Anime (protótipo)

Protótipo de site de streaming de anime inspirado visualmente na
Crunchyroll/Punishing Gray Raven, construído como projeto de portfólio.

> ⚠️ **Aviso:** este é um projeto de estudo/portfólio. Não distribui
> vídeos reais de anime (sem licença para isso), não tem afiliação com
> nenhum serviço de streaming e todo o catálogo de exemplo é fictício.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | HTML + CSS + JavaScript puro (sem build step) |
| Backend | Node.js + Express |
| Fonte de dados | [Jikan API](https://jikan.moe) (wrapper gratuito do MyAnimeList) |
| Cache | Em memória (Map com TTL) — trocar por Redis para produção |

## Estrutura do repositório

```
kuroshi/
├── frontend/
│   └── index.html          # site completo (SPA em JS puro, autocontido)
├── backend/
│   ├── package.json
│   ├── README.md            # detalhes de cada endpoint da API
│   └── src/
│       └── server.js        # proxy + cache para a Jikan API
├── .gitignore
├── LICENSE
└── README.md                 # este arquivo
```

## Como rodar localmente

### 1. Backend (dados reais de anime)

```bash
cd backend
npm install
npm start
```

Sobe em `http://localhost:4000`. Veja `backend/README.md` para a lista
completa de endpoints (`/api/top`, `/api/search`, `/api/anime/:id`, etc).

### 2. Front-end

O `frontend/index.html` é autocontido (não precisa de build). Para rodar
localmente:

```bash
cd frontend
npx serve .
# ou simplesmente abra o index.html direto no navegador
```

> Por padrão o front-end usa um catálogo fictício embutido, para funcionar
> sozinho sem depender do backend. Para ligar aos dados reais da Jikan,
> aponte as chamadas de `fetch` do `index.html` para
> `http://localhost:4000/api/...` (veja exemplos em `backend/README.md`).

## Funcionalidades já implementadas

- Home com destaque, carrosséis (Em alta, Lançamentos, Continuar assistindo, Recomendados)
- Catálogo com busca, filtro por gênero/status e ordenação
- Página de detalhes do anime com sinopse, metadados e lista de episódios
- Player customizado (play/pause, seek, próximo episódio com autoplay)
- Perfil (histórico, favoritos, configurações) persistido em `localStorage`
- Login/cadastro (mock, sem backend de autenticação ainda)
- Backend Express com proxy + cache para a Jikan API

## Roadmap (do prompt original do projeto)

- [ ] Autenticação real (JWT) + login social
- [ ] Banco de dados (PostgreSQL/MongoDB) para usuários, favoritos e histórico
- [ ] Player com HLS real (video.js/hls.js) quando houver fonte de vídeo própria
- [ ] Sistema de comentários por episódio
- [ ] Notificações de novos episódios
- [ ] Painel admin para catálogo próprio
- [ ] Testes (Jest) nas rotas do backend
- [ ] Deploy (frontend: Vercel/Netlify · backend: Railway/Render)

## Licença

MIT — veja [`LICENSE`](./LICENSE). O catálogo de exemplo é fictício;
dados reais consumidos via Jikan seguem os termos do MyAnimeList.
