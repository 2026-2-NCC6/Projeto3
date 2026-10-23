# Build multiestágio: a imagem final não leva código-fonte TS, dependências de desenvolvimento nem .env.
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build && npm prune --omit=dev

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
# Processo sem privilégios de root (menor privilégio).
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT:-3000}/api/v1/health || exit 1
# Aplica migrations pendentes (com DIRECT_URL) e sobe a API (com DATABASE_URL).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
