FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime: only Node + the static build + the zero-dependency server.
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8094 DATA_DIR=/data
COPY --from=build /app/dist ./dist
COPY package.json server.js ./
VOLUME /data
EXPOSE 8094
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
