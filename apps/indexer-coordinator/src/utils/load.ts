// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';

export function getFileContent(path: string, identifier: string): string {
  if (!fs.existsSync(path)) {
    const err_msg = `${identifier} file ${path} is does not exist`;
    throw new Error(err_msg);
  }

  try {
    return fs.readFileSync(path).toString();
  } catch (error) {
    const err_msg = `Failed to load ${identifier} file, ${error}`;
    throw new Error(err_msg);
  }
}
