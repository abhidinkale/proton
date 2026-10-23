# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app

# Vite inlines these at build time; runtime environment variables have no effect on
# the produced static bundle, so they must be supplied as build args.
ARG VITE_API_URL
ARG VITE_MEDPLUM_BASE_URL
ARG VITE_SYNTHETIC_MODE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_MEDPLUM_BASE_URL=$VITE_MEDPLUM_BASE_URL
ENV VITE_SYNTHETIC_MODE=$VITE_SYNTHETIC_MODE

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

# Replace default nginx config with SPA routing configuration
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass http://api:3002/; \
        proxy_http_version 1.1; \
        proxy_set_header Upgrade $http_upgrade; \
        proxy_set_header Connection "upgrade"; \
        proxy_set_header Host $host; \
        proxy_cache_bypass $http_upgrade; \
    } \
}' > /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
