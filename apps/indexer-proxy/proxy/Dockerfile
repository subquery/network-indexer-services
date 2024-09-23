# Builder
FROM rust:buster AS builder
RUN update-ca-certificates
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true

ARG SECRETS_SENTRY_DSN
ENV SECRETS_SENTRY_DSN=${SECRETS_SENTRY_DSN}

WORKDIR /subql

COPY . .

RUN --mount=type=cache,id=cargo_bin,target=~/.cargo/bin/ \
    --mount=type=cache,id=cargo_reg_index,target=~/.cargo/registry/index/ \
    --mount=type=cache,id=cargo_reg_cache,target=~/.cargo/registry/cache/ \
    --mount=type=cache,id=cargo_git,target=~/.cargo/git/db/ \
    --mount=type=cache,id=target,target=/subql/target/ \
    cargo update && cargo build --release && mv /subql/target/release/subql-indexer-proxy /subql/

# Final image
FROM debian:buster-slim

RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && \
    apt-get --assume-yes install curl && \
    update-ca-certificates

WORKDIR /subql

# Copy our build
COPY --from=builder /subql/subql-indexer-proxy .

# Use an unprivileged user.
RUN groupadd --gid 10001 subql && \
    useradd  --home-dir /subql \
             --create-home \
             --shell /bin/bash \
             --gid subql \
             --groups subql \
             --uid 10000 subql
RUN mkdir -p /subql/.local/share && \
	mkdir /subql/data && \
	chown -R subql:subql /subql && \
	ln -s /subql/data /subql/.local/share
USER subql:subql

ENTRYPOINT ["./subql-indexer-proxy"]
