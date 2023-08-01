// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as ReactDOMClient from 'react-dom/client';
import { Buffer } from 'buffer';

import App from './App';

import './index.css';

window.Buffer = Buffer;

let container = document.getElementById('root');

if (!container) {
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
}

const root = ReactDOMClient.createRoot(container);
root.render(<App />);
