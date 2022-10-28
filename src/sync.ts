import { argv } from './yargs';
import { ChainService } from './chain/chain.service';
import { PaygService } from './payg/payg.service';
import { ContractService } from './services/contract.service'
import { INestApplication } from '@nestjs/common';
import { getLogger, LogCategory, NestLogger } from './utils/logger';

export async function sync(app: INestApplication) {
    let contractService : ContractService = app.get<ContractService>(ContractService);
    let chainService: ChainService = app.get<ChainService>(ChainService);
    let paygServicee: PaygService = app.get<PaygService>(PaygService);
    await contractService.createSDK("0x2de44e00deb5b936a838d61978170a4dab9f23056736fed3409301f58db07d8b");
    let sdk = contractService.getSdk();

    const init_block = argv('start-block') as number;
    const old_block = (await chainService.getBlock());
    let db_last_block: number = old_block ? parseInt(old_block.value) : 0;
    getLogger(LogCategory.coordinator).info('db_last_block: ' + db_last_block);
    let last_block = Math.max(init_block, db_last_block);

    let contract = sdk.stateChannel;
    let chain_last_block = await contractService.getLastBlockNumber();
    getLogger(LogCategory.coordinator).info('chain_last_block: ' + chain_last_block);

    while(true) {
        getLogger(LogCategory.coordinator).info(`sync from: ${last_block} to ${chain_last_block}`);
        let blocks = chain_last_block - last_block;
        let steps = Math.floor(blocks / 500);
        getLogger(LogCategory.coordinator).info(`start sync total: ${blocks} steps: ${steps}`);
        let start = last_block;
        for (var i = 0; i <= steps; i++) {
            let end = start + 500;
            getLogger(LogCategory.coordinator).info(`step: ${i}: ${start} -> ${end}`);
            let _opens = await contract.queryFilter(contract.filters.ChannelOpen(), start, end);
            let _extends = await contract.queryFilter(contract.filters.ChannelExtend(), start, end);
            let _funds = await contract.queryFilter(contract.filters.ChannelFund(), start, end);
            let _checkpoints = await contract.queryFilter(contract.filters.ChannelCheckpoint(), start, end);
            let _terminates = await contract.queryFilter(contract.filters.ChannelTerminate(), start, end);
            let _finalizes = await contract.queryFilter(contract.filters.ChannelFinalize(), start, end);
            let _labors = await contract.queryFilter(contract.filters.ChannelLabor(), start, end);

            _opens.forEach(async (_open) => {
              await paygServicee.sync_open(_open.args.channelId.toString(), _open.args.indexer, _open.args.consumer, _open.args.total.toString(), _open.args.expiredAt.toNumber(), _open.args.deploymentId);
            });
            _extends.forEach(async (_extend) => {
                await paygServicee.sync_extend(_extend.args.channelId.toString(), _extend.args.expiredAt.toNumber());
            });
            _funds.forEach(async (_fund) => {
                await paygServicee.sync_fund(_fund.args.channelId.toString(), _fund.args.total.toString());
            });
            _checkpoints.forEach(async (_checkpoint) => {
                await paygServicee.sync_checkpoint(_checkpoint.args.channelId.toString(), _checkpoint.args.spent.toString());
            });
            _terminates.forEach(async (_terminate) => {
                await paygServicee.sync_terminate(_terminate.args.channelId.toString(), _terminate.args.spent.toString(), _terminate.args.terminatedAt.toNumber(), _terminate.args.terminateByIndexer);
            });
            _finalizes.forEach(async (_finalize) => {
                await paygServicee.sync_finalize(_finalize.args.channelId.toString(), _finalize.args.total.toNumber(), _finalize.args.remain.toNumber());
            });
            _labors.forEach(async (_labor) => {
                await paygServicee.sync_labor(_labor.args.deploymentId, _labor.args.indexer, _labor.args.amount.toString(), start);
            });

            last_block = end;
            start = end;
            let db_block = Math.min(chain_last_block, last_block);
            await chainService.updateBlock(db_block.toString());
        }
        chain_last_block = await contractService.getLastBlockNumber();

        if(chain_last_block <= last_block) {
            last_block = chain_last_block;
            break;
        }
    }

    getLogger(LogCategory.coordinator).info(`sync over, start listening`);
    contract.on("ChannelOpen", async (channelId, indexer, consumer, total, expiredAt, deploymentId) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_open(channelId.toString(), indexer, consumer, total.toString(), expiredAt.toNumber(), deploymentId);
    });
    contract.on("ChannelExtend", async (channelId, expiredAt) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_extend(channelId.toString(), expiredAt.toNumber());
    });
    contract.on("ChannelFund", async (channelId, total) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_fund(channelId.toString(), total.toString());
    });
    contract.on("ChannelCheckpoint", async (channelId, spent) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_checkpoint(channelId.toString(), spent.toString());
    });
    contract.on("ChannelTerminate", async (channelId, spent, terminatedAt, terminateByIndexer) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_terminate(channelId.toString(), spent.toString(), terminatedAt.toNumber(), terminateByIndexer);
    });
    contract.on("ChannelFinalize", async (channelId, total, remain) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_finalize(channelId.toString(), total.toNumber(), remain.toNumber());
    });
    contract.on("ChannelLabor", async (deploymentId, indexer, amount) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await chainService.updateBlock(chain_last_block.toString());
        await paygServicee.sync_labor(deploymentId, indexer, amount.toString(), chain_last_block);
    });
}
