// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { ProjectService } from './project.service';
import { getLogger } from 'src/utils/logger';
import { ContractService } from './contract.service';
import { IndexingStatus } from './types';
import { cidToBytes32 } from 'src/utils/contractSDK';

@Injectable()
export class ReportService {
  constructor(private projectService: ProjectService, private contractService: ContractService) {
    this.periodicReport();
  }

  async getIndexingProjects() {
    const projects = await this.projectService.getProjects();
    const indexingProjects = await Promise.all(
      projects.map(async ({ id }) => {
        const status = await this.contractService.deploymentStatusByIndexer(id);
        const project = await this.projectService.updateProjectStatus(id, status);
        return project;
      }),
    );

    return indexingProjects.filter(
      ({ queryEndpoint, status }) =>
        !isEmpty(queryEndpoint) && [IndexingStatus.INDEXING, IndexingStatus.READY].includes(status),
    );
  }

  async reportIndexingServices() {
    await this.contractService.updateContractSDK();
    const wallet = this.contractService.getWallet();
    const sdk = this.contractService.getSdk();
    if (!wallet || !sdk) return;

    const indexingProjects = await this.getIndexingProjects();
    if (isEmpty(indexingProjects)) return;

    indexingProjects.forEach(async ({ id }) => {
      try {
        // FIXME: extract `mmrRoot` should get from query endpoint `_por`;
        const mmrRoot = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';
        const { lastProcessedHeight } = await this.projectService.getQueryMetaData(id);
        const timestamp = Date.now();

        const tx = await sdk.queryRegistry
          .connect(wallet)
          .reportIndexingStatus(cidToBytes32(id), lastProcessedHeight, mmrRoot, timestamp);
        await tx.wait(1);

        getLogger('report').info(`report status for proejct: ${id} ${lastProcessedHeight}`);
      } catch (e) {
        getLogger('report').error(e, `failed to report status for proejct: ${id}`);
      }
    });
  }

  periodicReport() {
    const interval = 30000;
    setInterval(() => {
      this.reportIndexingServices();
    }, interval);
  }
}
