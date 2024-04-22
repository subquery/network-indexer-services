// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import copy from 'copy-to-clipboard';

export const navigatorClip = {
  clipboard: {
    writeText: (text: string) => {
      copy(text);
      return Promise.resolve();
    },
  },
};

if (!window?.navigator?.clipboard?.writeText) {
  // clipboard API is only available in HTTPS
  // So make polyfill for it.
  // WalletConnect use it.
  // it's read-only if browser inject it. set it would do nothing.
  // @ts-ignore
  window.navigator.clipboard = navigatorClip.clipboard;
}
