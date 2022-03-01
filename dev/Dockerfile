FROM node:16-alpine

WORKDIR /app

COPY . .

RUN npm install -g @nestjs/cli
RUN npm install
RUN npm run build
RUN npm cache clean --force

RUN apk add --no-cache tini git curl docker-cli docker-compose
ENTRYPOINT ["/sbin/tini", "--", "/app/bin/run"]
