FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

RUN npm install -g pnpm && apk add --no-cache curl fontconfig font-noto \
    chromium nss freetype harfbuzz ca-certificates

# Tell pdf-renderer.ts to use system Chromium instead of @sparticuz/chromium binary
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/assets ./assets

RUN pnpm install --frozen-lockfile --prod

EXPOSE 8081

CMD ["node", "dist/main"]
