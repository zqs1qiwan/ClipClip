# ClipClip production image (single container).
# Runtime data must be mounted at /data; the container runs as non-root (node, uid/gid 1000).
#
# Base image: Node.js 22 LTS on Alpine, pinned by digest for reproducible and
# supply-chain-friendly builds. To update:
#   docker pull node:22-alpine
#   docker inspect --format '{{index .RepoDigests 0}}' node:22-alpine
#   (or: docker buildx imagetools inspect node:22-alpine)
# then replace the sha256 below, keeping the tag for readability.
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a

WORKDIR /app

# Zero runtime dependencies: only the files needed to run are copied (no npm install).
COPY package.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public

ENV NODE_ENV=production \
    CLIPCLIP_HOST=0.0.0.0 \
    CLIPCLIP_PORT=5678 \
    CLIPCLIP_DATA_DIR=/data

# Pre-create /data and hand it to the runtime user:
# - named volume: Docker copies this ownership into a fresh volume
# - bind mount: run `chown -R 1000:1000 <data-dir>` once on the host
RUN mkdir -p /data && chown -R node:node /data

LABEL org.opencontainers.image.title="ClipClip" \
      org.opencontainers.image.description="Self-hosted web clipboard for text, paste links, and small file drops." \
      org.opencontainers.image.version="0.1.0" \
      org.opencontainers.image.licenses="MIT"

EXPOSE 5678

# Healthcheck uses Node's built-in fetch against /api/health (no curl/wget in the image).
# scripts/healthcheck.js is shared with the docker-compose healthcheck definition.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "scripts/healthcheck.js"]

# Non-root runtime (node user, uid/gid 1000). Compose may override with `user:` to match
# a host directory owner when using a bind mount.
USER node

CMD ["node", "src/server/index.js"]