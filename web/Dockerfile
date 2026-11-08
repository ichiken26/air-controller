# Build context: repository root (web/ depends on ../protocol). See docker-compose.yml.

FROM node:22-bookworm-slim AS build
# npm 10.9 crashes resolving this tree ("Cannot read properties of null (reading 'edgesOut')").
RUN npm install -g npm@11
WORKDIR /app
COPY protocol/package.json protocol/package-lock.json protocol/
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci --ignore-scripts
COPY protocol/src protocol/src
COPY web web
RUN cd web && npx svelte-kit sync && npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TZ=Asia/Tokyo
WORKDIR /app
# Every package is bundled into build/ (all of them are devDependencies), so no node_modules here.
COPY --from=build /app/web/build build
COPY --from=build /app/web/package.json package.json
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/state').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "build"]
