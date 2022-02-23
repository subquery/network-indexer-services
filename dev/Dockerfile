FROM node:16-alpine

WORKDIR /app

COPY . .

RUN npm install -g @nestjs/cli
RUN npm install
RUN npm run build
RUN npm cache clean --force

RUN apk add --no-cache tini git curl docker-cli
ENTRYPOINT ["/sbin/tini", "--", "/app/bin/run"]

# ARG RELEASE_VERSION
# ENTRYPOINT ["subql-coordinator"]
# RUN npm i -g .

# FROM node:16-alpine
# ENV TZ utc

# RUN apk add --no-cache tini git curl
# COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules

# ENTRYPOINT ["/sbin/tini", "--", "/usr/local/lib/node_modules/@subql/indexer-coordinator/bin/run"]
# CMD ["-f","/app"]
