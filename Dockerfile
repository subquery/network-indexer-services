FROM node:16-alpine

WORKDIR /app

ARG RELEASE_VERSION
RUN npm i -g @subql/indexer-coordinator

RUN apk add --no-cache tini git curl
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/lib/node_modules/@subql/indexer-coordinator/bin/run"]
CMD ["-f","/app"]
