# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
ARG APP_VERSION=dev
ARG APP_COMMIT_SHA=local
ENV VITE_APP_VERSION=$APP_VERSION \
    VITE_APP_COMMIT_SHA=$APP_COMMIT_SHA
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY client ./client
COPY server ./server
RUN npm test && npm run build

FROM node:24-alpine AS production-dependencies
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24-alpine AS runtime
ARG APP_VERSION=dev
ARG APP_COMMIT_SHA=local
LABEL org.opencontainers.image.title="Proof & Perk Loyalty Program"
LABEL org.opencontainers.image.description="React and Express loyalty-program assessment"
LABEL org.opencontainers.image.source="https://github.com/aminhaiqal/loyalty-program-assessment"
LABEL org.opencontainers.image.version=$APP_VERSION
LABEL org.opencontainers.image.revision=$APP_COMMIT_SHA

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads \
    APP_VERSION=$APP_VERSION \
    APP_COMMIT_SHA=$APP_COMMIT_SHA

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node server ./server
COPY --from=build --chown=node:node /app/dist ./dist

RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

STOPSIGNAL SIGTERM
CMD ["node", "server/src/server.js"]
