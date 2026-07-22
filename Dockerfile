# Using Node's built-in node:sqlite instead of the better-sqlite3 npm
# package, so there's no native module to compile — no build
# toolchain (python/make/g++) needed in this image at all.
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY ../../Downloads/files-4 .

# No EXPOSE / PORT — this process only opens an outbound WebSocket to
# Discord's gateway, it doesn't serve HTTP, so nothing needs to listen
# on a port.
CMD ["node", "index.js"]
