import { argv } from './yargs';
import { ChainService } from './chain/chain.service';
import { PaygService } from './payg/payg.service';
import { ContractService } from './services/contract.service'
import { INestApplication } from '@nestjs/common';
import { getLogger, LogCategory, NestLogger } from './utils/logger';
import { GraphqlQueryClient, NETWORK_CONFIGS } from '@subql/network-clients';
import { GetSteteChannels } from '@subql/network-query';

export async function sync(app: INestApplication) {
    let client: GraphqlQueryClient;
    const config = NETWORK_CONFIGS.kepler;
    client = new GraphqlQueryClient(config);
    const apolloClient = client.explorerClient;
    const result = await apolloClient.query({
      query: GetSteteChannels,
      variables: { status: "OPEN" },
    });

    let contractService : ContractService = app.get<ContractService>(ContractService);
    let paygServicee: PaygService = app.get<PaygService>(PaygService);
    await contractService.createSDK("0x2de44e00deb5b936a838d61978170a4dab9f23056736fed3409301f58db07d8b");
    let sdk = contractService.getSdk();

    getLogger(LogCategory.coordinator).info(`sync from Subquery Project...`);
    result.data.stateChannels.nodes.forEach(async (stateChannel) => {
        await paygServicee.sync_channel(
            stateChannel.id, 
            stateChannel.deploymentId, 
            stateChannel.indexer, 
            stateChannel.consumer, 
            stateChannel.total,
            stateChannel.spent,
            new Date(stateChannel.expiredAt).valueOf()/ 1000, 
            new Date(stateChannel.terminatedAt).valueOf()/ 1000, 
            stateChannel.terminateByIndexer,
            stateChannel.isFinal
        );
    });

    let contract = sdk.stateChannel;

    getLogger(LogCategory.coordinator).info(`sync over, start listening`);
    contract.on("ChannelOpen", async (channelId, indexer, consumer, total, expiredAt, deploymentId) => {
        await paygServicee.sync_open(channelId.toString(), indexer, consumer, total.toString(), price.toString(), expiredAt.toNumber(), deploymentId);
    });
    contract.on("ChannelExtend", async (channelId, expiredAt) => {
        await paygServicee.sync_extend(channelId.toString(), expiredAt.toNumber());
    });
    contract.on("ChannelFund", async (channelId, total) => {
        await paygServicee.sync_fund(channelId.toString(), total.toString());
    });
    contract.on("ChannelCheckpoint", async (channelId, spent) => {
        await paygServicee.sync_checkpoint(channelId.toString(), spent.toString());
    });
    contract.on("ChannelTerminate", async (channelId, spent, terminatedAt, terminateByIndexer) => {
        await paygServicee.sync_terminate(channelId.toString(), spent.toString(), terminatedAt.toNumber(), terminateByIndexer);
    });
    contract.on("ChannelFinalize", async (channelId, total, remain) => {
        await paygServicee.sync_finalize(channelId.toString(), total.toNumber(), remain.toNumber());
    });
    contract.on("ChannelLabor", async (deploymentId, indexer, amount) => {
        let chain_last_block = await contractService.getLastBlockNumber();
        await paygServicee.sync_labor(deploymentId, indexer, amount.toString(), chain_last_block);
    });
}
