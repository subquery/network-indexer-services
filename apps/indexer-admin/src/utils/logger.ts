// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

class Logger {
  private readonly prefix: string;

  constructor(prefix?: string) {
    this.prefix = prefix ?? '';
  }

  getLogger(scope: string): Logger {
    return new Logger(`${this.prefix}[${scope}]`);
  }

  public l(message: any, ...rest: any[]): void {
    console.log(`${this.prefix}${message?.toString()}`, ...rest);
  }

  public w(message: any, ...rest: any[]): void {
    console.warn(`${this.prefix}${message?.toString()}`, ...rest);
  }

  public e(message: any, ...rest: any[]): void {
    console.error(`${this.prefix}${message?.toString()}`, ...rest);
  }
}

export const logger = new Logger();

export default Logger;
