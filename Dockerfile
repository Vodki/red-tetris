# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies needed for native modules
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js
RUN npm run build

# Stage 3: Production dependencies only
FROM node:20-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 4: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built Next.js app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy custom server and game logic
COPY --from=builder /app/src/game ./src/game
COPY --from=builder /app/src/server.js ./src/server.js
COPY --from=builder /app/package.json ./package.json

# Copy production node_modules for custom server dependencies
COPY --from=prod-deps /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["node", "src/server.js"]
