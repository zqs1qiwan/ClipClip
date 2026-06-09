FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY scripts ./scripts
COPY src ./src
COPY public ./public

ENV NODE_ENV=production
ENV CLIPCLIP_HOST=0.0.0.0
ENV CLIPCLIP_PORT=8080
ENV CLIPCLIP_DATA_DIR=/data

EXPOSE 8080

CMD ["node", "src/server/index.js"]
