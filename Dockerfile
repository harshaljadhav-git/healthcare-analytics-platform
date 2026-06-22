# ====================================================
# STAGE 1: Build Frontend and Bundled Backend Server
# ====================================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Install package profiles
COPY package*.json ./
RUN npm ci

# Copy full application sources
COPY . .

# Run production compilation tasks
RUN npm run build

# ====================================================
# STAGE 2: Microscopic Containerised Production Runtime Node
# ====================================================
FROM node:22-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production

# Copy built artifacts from Stage 1
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Exposed port matches standard nginx ingress routing boundary
EXPOSE 3000

# Executing standard health probing checks
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["npm", "run", "start"]
