import { Injectable } from '@nestjs/common';
import { isValidPrivate, toBuffer } from 'ethereumjs-util';
import { Wallet, ethers } from 'ethers';
import _, { isEmpty } from 'lodash';
import { JsonRpcProvider } from '@ethersproject/providers';
import { ContractSDK } from '@subql/contract-sdk';
import { AccountService } from 'src/account/account.service';
import { ProjectService } from './project.service';
import { initContractSDK } from 'src/utils/contractSDK';
import { getLogger } from 'src/utils/logger';
import { decrypt } from '../utils/encrypto';

// TODO: replace with command line input
const url = 'http://127.0.0.1:9933';
const chainID = 1281;

@Injectable()
export class ReportService {
  private wallet: Wallet;
  private accountID: string;
  private currentController: string;
  private provider: JsonRpcProvider;
  private sdk: ContractSDK;

  constructor(
    private projectService: ProjectService,
    private accountService: AccountService,
  ) {
    this.provider = new ethers.providers.StaticJsonRpcProvider(url, chainID);
    this.periodicReport();
  }

  isWalletValid() {
    return this.wallet?.address.toLowerCase() === this.currentController;
  }

  async updateContractSDK() {
    const accounts = await this.accountService.getAccounts();
    if (isEmpty(accounts)) return;

    const indexer = await this.accountService.getIndexer();
    if (indexer && this.wallet && this.sdk) {
      this.currentController = (await this.sdk.indexerRegistry.indexerToController(indexer)).toLowerCase();
      if (this.isWalletValid())  return;

      this.accountService.deleteAccount(this.accountID);
      this.wallet = undefined;
      this.sdk = undefined;
      this.accountID = undefined;
    }
  
    accounts.forEach(async ({ id, indexer, controller: encryptedController }) => {
      const controller = decrypt(encryptedController);
      if (isEmpty(controller) || !controller.startsWith('0x') || !isValidPrivate(toBuffer(controller))) return;

      try {
        const controllerBuff = toBuffer(controller);
        const wallet = new Wallet(controllerBuff, this.provider);
        const sdk = await initContractSDK(wallet);
        this.currentController = (await sdk.indexerRegistry.indexerToController(indexer)).toLowerCase();
  
        if (wallet.address.toLowerCase() === this.currentController) {
          this.accountID = id;
          this.wallet = wallet;
          this.sdk = sdk;
        }
      } catch (e) {
        getLogger('report').error(e, 'init contract sdk failed');
        return;
      }
    });
  }

  async reportIndexingServices() {
    const indexingProjects = await this.projectService.getIndexingProjects();
    if (isEmpty(indexingProjects)) return;

    await this.updateContractSDK();
    if (!this.wallet || !this.sdk) return;

    indexingProjects.forEach(async (project) => {
      try {
        if (isEmpty(project.queryEndpoint)) return;
        const metadata = await this.projectService.getQueryMetaData(project.id);
        // FIXME: extract `mmrRoot` and `blockheight`
        const { lastProcessedHeight } = metadata;
        const timestamp = Date.now();
        this.sdk.queryRegistry.connect(this.wallet).reportIndexingStatus(
          project.id,
          10,
          '0xab3921276c8067fe0c82def3e5ecfd8447f1961bc85768c2a56e6bd26d3c0c55',
          timestamp
        );
        getLogger('report').info(`report status for proejct: ${project.id} ${timestamp}`);
      } catch (e) {
        getLogger('report').error(e, `failed to report status for proejct: ${project.id}`);
      }
    });
  }

  periodicReport() {
    const interval = 5000;
    setInterval(() => {
      this.reportIndexingServices();
    }, interval);
  }
}
