# ---- Builder ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps
COPY package.json package-lock.json* pnpm-lock.yaml* bun.lockb* yarn.lock* ./
RUN set -eux; \
  if [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then npm i -g pnpm && pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then npm i -g yarn && yarn --frozen-lockfile; \
  else npm i; fi

# Copy source
COPY . .

# Build client and server
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
ENV NODE_ENV=production

WORKDIR /app

# Copy built artifacts and minimal runtime deps
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/public ./server/public

# Expose port (configurable via PORT)
ENV PORT=5000
EXPOSE 5000

# Required runtime envs (documented)
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - DATABASE_URL
# - ALLOWED_ORIGINS (optional, comma-separated)

CMD ["node", "dist/index.js"]
