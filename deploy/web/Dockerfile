# Web image: builds the Vite app and serves it with nginx, proxying /api to the api service.
# Build context is the repository root (see docker-compose.yml).
FROM node:22-alpine AS build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# live: every role reads and writes the database through the API. Unset, the app falls back to the
# in-browser mocks (frontend/src/api/dataSource.ts), which serve fixtures and never call the API, so
# ordering and planning would appear to do nothing. The API is same-origin here: nginx proxies /api.
ARG VITE_DATA_SOURCE=live
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /frontend/dist /usr/share/nginx/html
EXPOSE 80
