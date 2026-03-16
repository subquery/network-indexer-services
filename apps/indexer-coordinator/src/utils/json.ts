// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export function safeJSONParse(data: string) {
  try {
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}
