# Site — Tennis Analytics

Site de autoria e administração (React 18 + Vite + TypeScript). Usa a mesma API e as mesmas contas
do app. O visual segue a identidade do app (fundo escuro, verde-limão, Barlow).

| Quem entra | O que faz | Requisitos |
| --- | --- | --- |
| Jogador | Consulta sessões e indicadores dele e dos dependentes, por período | RF13 |
| Autor | Cria treinos, edita rascunhos, valida, ensaia, envia para revisão, publica, cria novas versões, preenche o marketplace e vê estatísticas anônimas de uso | RF14, RF15, RF16, RF20 |
| Admin | Tudo acima para qualquer treino, mais usuários e papéis, raquetes (bloqueio), categorias, limites da máquina e retenção, sessões, auditoria e envios à plataforma mãe | RF17, RF23 |

O cadastro de conta continua só no app (exige declarar maioridade). O site não decide permissões:
ele esconde o que o papel não pode usar, mas quem barra é a API (403/409).

## Rodando

```bash
cp .env.example .env   # VITE_API_URL aponta para a API
npm install
npm run dev            # http://localhost:5173 (já está em CORS_ORIGINS do .env.example da API)
```

```bash
npm test               # node:test: cliente HTTP, regras de versão e de conteúdo
npm run build          # checa tipos e gera dist/
npm run preview        # serve o build com a mesma CSP do deploy
```

## Segurança

- **Tokens:** o token de acesso (15 min) fica só em memória. O refresh fica no `sessionStorage`:
  sobrevive a recarregar a página, some ao fechar a aba e não passa para outras abas. Nada vai para
  `localStorage` nem para cookie.
- **CSP:** sem script inline nem de terceiros. As fontes são servidas pelo próprio site, sem Google
  Fonts, para o IP de quem acessa não ir a terceiros (LGPD). `connect-src` só libera a API, e
  `frame-ancestors 'none'` impede o site de ser embutido (clickjacking). Os cabeçalhos estão no
  `render.yaml`, e o `vite preview` aplica a mesma política.
- **Cache:** a API responde `Cache-Control: no-store`, então os dados pessoais não ficam no cache do
  navegador.
- **Dependências:** `npm audit` bloqueia o CI a partir de vulnerabilidades moderadas.

## Deploy (Render)

O `SRC/backend/render.yaml` cria o site estático `tennis-analytics-site`, junto com a API. Depois do primeiro deploy:

1. Se o Render der à API um endereço diferente de `tennis-analytics-api.onrender.com`, ajuste
   `VITE_API_URL` e o `connect-src` da CSP no `SRC/backend/render.yaml`.
2. Inclua a URL do site em `CORS_ORIGINS` da API.
