// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import handlebars from 'handlebars';

type TemplateType = {
  nodeServiceName: string;
  nodeVersion: string;
  database: string;
  servicePort: number;
  queryName: string;
  queryVersion: string;
};

export function generateDockerComposeFile(data: TemplateType) {
  try {
    const file = fs.readFileSync('../../compose-files/template.yml', 'utf8');
    const template = handlebars.compile(file);
    fs.writeFileSync(`../../compose-files/${data.nodeServiceName}.yml`, template(data));
  } catch (e) {
    console.log(e);
  }
}
