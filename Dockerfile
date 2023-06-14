FROM node:16 AS BUILD_IMAGE

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

RUN apk add --no-cache curl docker-cli grep

# Install Docker Compose
RUN curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-Linux-x86_64 -o /usr/local/bin/docker-compose \
    && chmod +x /usr/local/bin/docker-compose

WORKDIR /usr/src/app

# Copy from build image
COPY --from=BUILD_IMAGE /usr/src/app/dist ./dist
COPY --from=BUILD_IMAGE /usr/src/app/node_modules ./node_modules
COPY --from=BUILD_IMAGE /usr/src/app/package.json package.json

ENTRYPOINT [ "node", "dist/main.js" ]
