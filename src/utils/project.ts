// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Project } from 'src/project/project.model';

type ProjectConfig = {
  networkEndpoint: string;
  networkDictionary: string;
  nodeVersion: string;
  queryVersion: string;
  poiEnabled: boolean;
};

export function projectConfigChanged(project: Project, config: ProjectConfig): boolean {
  return (
    project.networkEndpoint !== config.networkEndpoint ||
    project.networkDictionary !== config.networkDictionary ||
    project.nodeVersion !== config.nodeVersion ||
    project.queryVersion !== config.queryVersion ||
    project.poiEnabled !== config.poiEnabled
  );
}
