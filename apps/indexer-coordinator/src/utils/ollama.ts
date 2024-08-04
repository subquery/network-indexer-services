// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fetch from 'node-fetch';
import { LLMOngoingStreamRequestMeta } from 'src/project/types';

export interface Config {
  host: string;
}

export interface DeleteRequest {
  model: string;
}

export interface PullRequest {
  model: string;
  insecure?: boolean;
  stream?: boolean;
}

export interface ModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

export interface ModelResponse {
  name: string;
  modified_at: Date;
  size: number;
  digest: string;
  details: ModelDetails;
  expires_at: Date;
  size_vram: number;
}

export interface ListResponse {
  models: ModelResponse[];
}

export interface ErrorResponse {
  error: string;
}

export class AbortableAsyncIterator {
  private readonly abortController: AbortController;
  // private readonly itr: AsyncGenerator<T | ErrorResponse>;
  private readonly stream: NodeJS.ReadableStream;
  readonly meta: LLMOngoingStreamRequestMeta;
  constructor(
    abortController: AbortController,
    // itr: AsyncGenerator<ErrorResponse>,
    stream: NodeJS.ReadableStream,
    meta: LLMOngoingStreamRequestMeta
  ) {
    this.abortController = abortController;
    this.stream = stream;
    this.meta = meta;
  }

  abort() {
    this.abortController.abort();
  }

  async *[Symbol.asyncIterator]() {
    let buffer = '';
    // console.log('=========  terrateor ===');
    this.stream.setEncoding('utf8');
    for await (const message of this.stream) {
      // console.log(`message:${message} hh`);
      buffer += message;
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        try {
          const message = JSON.parse(part);
          if ('error' in message) {
            throw new Error(message.error);
          }
          yield message;

          if (message.done || message.status === 'success') {
            return;
          }
        } catch (error) {
          console.warn('invalid json: ', part);
        }
      }
    }

    for (const part of buffer.split('\n').filter((p) => p !== '')) {
      try {
        const message = JSON.parse(part);
        if ('error' in message) {
          throw new Error(message.error);
        }
        yield message;

        if (message.done || message.status === 'success') {
          return;
        }
      } catch (error) {
        console.warn('invalid json: ', part);
      }
    }
    throw new Error('Did not receive done or success response in stream.');
  }
}

const defaultHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

export class Ollama {
  config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async list(): Promise<ListResponse> {
    const url = new URL('api/tags', this.config.host).toString();
    const response = await fetch(url, {
      method: 'GET',
      headers: defaultHeaders,
    });
    return (await response.json()) as ListResponse;
  }

  async ps(): Promise<ListResponse> {
    const url = new URL('api/ps', this.config.host).toString();
    const response = await fetch(url, {
      method: 'GET',
      headers: defaultHeaders,
    });
    return (await response.json()) as ListResponse;
  }

  async delete(request: DeleteRequest) {
    const url = new URL('api/delete', this.config.host).toString();
    await fetch(url, {
      method: 'DELETE',
      body: JSON.stringify({
        name: request.model,
      }),
      headers: defaultHeaders,
    });
    return { status: 'success' };
  }

  async pull(request: PullRequest) {
    const host = new URL(this.config.host).toString();
    const url = new URL('api/pull', this.config.host).toString();
    const model = normalizeModelName(request.model);
    const abortController = new AbortController();
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        name: model,
        stream: request.stream,
        insecure: request.insecure,
      }),
      headers: defaultHeaders,
      signal: abortController.signal,
    });

    const abortableAsyncIterator = new AbortableAsyncIterator(abortController, response.body, {
      model,
      host,
    });
    return abortableAsyncIterator;
  }
}

export function normalizeModelName(model: string): string {
  if (model.lastIndexOf(':') === -1) {
    return model + ':latest';
  }
  return model;
}
