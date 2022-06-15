FROM node:16-alpine

WORKDIR /app

COPY . .

RUN apk add --no-cache tini git curl docker-cli docker-compose grep
RUN apk add --no-cache python3 g++ make

RUN npm install -g @nestjs/cli
RUN npm install --production
RUN npm run build
RUN npm cache clean --force

ENTRYPOINT ["/sbin/tini", "--", "/app/bin/run"]
