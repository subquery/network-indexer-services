FROM node:16-alpine AS BUILD_IMAGE

RUN apk update && apk add --no-cache yarn curl bash tini git docker-cli docker-compose grep make python3 g++

# Install node-prune
RUN curl -sfL https://install.goreleaser.com/github.com/tj/node-prune.sh | bash -s -- -b /usr/local/bin

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn --network-timeout 600000 --frozen-lockfile

COPY . .

RUN yarn build

# Remove development dependencies
RUN npm prune --production

FROM node:16-alpine

RUN apk add --no-cache curl docker-cli docker-compose grep

# Find the installed docker-compose and store its path
RUN DOCKER_COMPOSE_PATH=$(find / -name docker-compose -print -quit) \
    && ln -s $DOCKER_COMPOSE_PATH /usr/local/bin/docker-compose

WORKDIR /usr/src/app

# Copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/node_modules ./node_modules
COPY --from=BUILD_IMAGE /usr/src/app/package.json package.json

ENTRYPOINT [ "node", "dist/main.js" ]
