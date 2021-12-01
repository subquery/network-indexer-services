import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import { AccountService } from 'src/account/account.service';
import { ProjectService } from './project.service';
import { getLogger } from 'src/utils/logger';
import { ContractService } from './contract.service';
import { IndexingStatus } from './types';

@Injectable()
export class ReportService {
  constructor(
    private projectService: ProjectService,
    private contractService: ContractService,
  ) {
    this.periodicReport();
  }

  async reportIndexingServices() {
    const indexingProjects = await this.projectService.getIndexingProjects();
    if (isEmpty(indexingProjects)) return;

    await this.contractService.updateContractSDK();
    const wallet = this.contractService.getWallet();
    const sdk = this.contractService.getSdk();
    if (!wallet || !sdk) return;

    indexingProjects.forEach(async (project) => {
      try {
        const { id } = project;
        const status = await this.contractService.deploymentStatusByIndexer(id);
        if (isEmpty(project.indexerEndpoint) || [IndexingStatus.NOTSTART,IndexingStatus.TERMINATED].includes(status)) return;

        const metadata = await this.projectService.getIndexerMetaData(id);
        // FIXME: extract `mmrRoot` and `blockheight`
        const { lastProcessedHeight } = metadata;
        const mmrRoot = '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55';
        const timestamp = Date.now();
        await sdk.queryRegistry.connect(wallet).reportIndexingStatus(id, 10, mmrRoot, timestamp);
        getLogger('report').info(`report status for proejct: ${id} ${timestamp}`);
      } catch (e) {
        getLogger('report').error(e, `failed to report status for proejct: ${project.id}`);
      }
    });
  }

  periodicReport() {
    const interval = 1800000;
    setInterval(() => {
      this.reportIndexingServices();
    }, interval);
  }
}
