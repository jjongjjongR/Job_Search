FROM node:22-alpine AS deps

WORKDIR /app
ENV SCARF_ANALYTICS=false
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY . .
RUN pnpm run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV SCARF_ANALYTICS=false
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist

EXPOSE 3001

CMD ["node", "dist/main.js"]
