FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV CLIPCLIP_HOST=0.0.0.0
ENV CLIPCLIP_PORT=5678
ENV CLIPCLIP_DATA_DIR=/data

EXPOSE 5678

CMD ["node", "src/server/index.js"]
