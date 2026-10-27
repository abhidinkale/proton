# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
WORKDIR /app

# Install build dependencies if needed
FROM base AS dependencies
COPY package*.json ./
RUN npm ci --only=production

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002

# Run as non-root user for HIPAA container security compliance
RUN addgroup -S proton && adduser -S proton -G proton

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Ensure data directory exists and is owned by proton user
RUN mkdir -p /app/data && chown -R proton:proton /app

USER proton

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/health || exit 1

CMD ["node", "index.js"]
