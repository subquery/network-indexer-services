// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum ProjectEvent {
  ProjectStarted = 'project_started',
  ProjectStopped = 'project_stopped',
}

export enum PaygEvent {
  Opened = 'channel_opened',
  Stopped = 'channel_stopped',
  State = 'channel_state',
}

export enum AccountEvent {
  Indexer = 'account_indexer',
  Controller = 'account_controller',
}

export enum OllamaEvent {
  PullProgress = 'pull_progress',
}