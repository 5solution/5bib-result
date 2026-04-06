FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

RUN npm install -g pnpm && apk add --no-cache curl fontconfig font-noto

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/assets ./assets

EXPOSE 8081

CMD ["node", "dist/main"]
