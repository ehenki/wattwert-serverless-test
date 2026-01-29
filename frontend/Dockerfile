# syntax=docker/dockerfile:1
ARG NODE_VERSION=22

FROM node:22-bookworm-slim AS deps
WORKDIR /src
COPY package*.json ./ package-lock.json ./
# If you use yarn or pnpm, swap to: corepack enable && yarn install --frozen-lockfile
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /src
COPY --from=deps /src/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1  
# Build a minimal runtime with standalone output
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /src	
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Copy standalone server & assets
COPY --from=builder /src/.next/standalone ./
COPY --from=builder /src/public ./public
COPY --from=builder /src/.next/static ./.next/static
EXPOSE 3000
# Alternatively, use:
# CMD ["npm", "start"]
CMD ["node", "server.js"] 
