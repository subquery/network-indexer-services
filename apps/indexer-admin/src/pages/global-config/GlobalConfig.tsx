// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useEffect, useState } from 'react';
import { BsBoxArrowInUpRight } from 'react-icons/bs';
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined';
import { useMutation, useQuery } from '@apollo/client';
import { openNotification, Spinner, Tag, Typography } from '@subql/components';
import { SQT_DECIMAL, STABLE_COIN_DECIMAL } from '@subql/network-config';
import { formatSQT, useAsyncMemo, useStableCoin } from '@subql/react-hooks';
import { useUpdate } from 'ahooks';
import { Button, Form, Input, Select, Switch, Tooltip } from 'antd';
import { useForm } from 'antd/es/form/Form';
import BigNumberJs from 'bignumber.js';
import { STABLE_COIN_ADDRESS } from 'conf/stableCoin';
import { formatUnits, parseEther, parseUnits } from 'ethers/lib/utils';
import styled from 'styled-components';
import { SubqlInput } from 'styles/input';

import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import {
  AllConfig,
  ConfigKey,
  GET_ALL_CONFIG,
  getIndexerSocialCredibility,
  SET_CONFIG,
} from 'utils/queries';
import { SUPPORTED_NETWORK, TOKEN_SYMBOL } from 'utils/web3';

import NodeOperatorInformation from './components/NodeOperatorInforamtion';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border-radius: 8px;
  border: 1px solid var(--sq-gray300);
  background: #fff;
  width: 100%;
`;

const GlobalConfig: FC = () => {
  const { indexer: account, loading } = useCoordinatorIndexer();

  const sdk = useContractSDK();
  const { transPrice } = useStableCoin(sdk, SUPPORTED_NETWORK);
  const update = useUpdate();
  const [config, setConfig] = useState({
    autoReduceOverAllocation: false,
    flexEnabled: false,
  });

  const configQueryData = useQuery<AllConfig>(GET_ALL_CONFIG);
  const [setConfigMutation] = useMutation(SET_CONFIG);

  const [form] = useForm();

  const socialCredibility = useAsyncMemo(async () => {
    if (!account) return false;
    const res = await getIndexerSocialCredibility({ indexer: account });

    return res.data?.indexerParams?.[0]?.socialCredibility;
  }, [account]);

  useEffect(() => {
    if (configQueryData.data) {
      setConfig({
        ...config,
        autoReduceOverAllocation:
          configQueryData.data.allConfig.find(
            (i) => i.key === ConfigKey.AutoReduceAllocationEnabled
          )?.value === 'true',
        flexEnabled:
          configQueryData.data.allConfig.find((i) => i.key === ConfigKey.FlexEnabled)?.value ===
          'true',
      });

      const price = configQueryData.data.allConfig.find((i) => i.key === ConfigKey.FlexPrice);
      const priceRatio = configQueryData.data.allConfig.find(
        (i) => i.key === ConfigKey.FlexPriceRatio
      );
      const validPeriod = configQueryData.data.allConfig.find(
        (i) => i.key === ConfigKey.FlexValidPeriod
      );
      const tokenAddress = configQueryData.data.allConfig.find(
        (i) => i.key === ConfigKey.FlexTokenAddress
      );

      const isSQT = tokenAddress?.value === sdk?.sqToken.address || !tokenAddress?.value;

      form.setFieldValue('priceRatio', BigNumberJs(priceRatio?.value || '0'));
      form.setFieldValue('flexTokenAddress', tokenAddress?.value || sdk?.sqToken.address);
      form.setFieldValue(
        'price',
        BigNumberJs(
          isSQT
            ? formatSQT(price?.value || '0')
            : formatUnits(price?.value || '0', STABLE_COIN_DECIMAL[SUPPORTED_NETWORK])
        ).multipliedBy(1000)
      );
      form.setFieldValue('validPeriod', BigNumberJs(validPeriod?.value || '0').dividedBy(86400));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQueryData.data, form, sdk]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: '64px 78px',
        width: '100%',
      }}
    >
      <Typography variant="h4">Config</Typography>

      <Wrapper>
        <NodeOperatorInformation />
      </Wrapper>

      <Wrapper>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Auto Reduce Over Allocation</Typography>
          {!configQueryData.previousData && configQueryData.loading ? (
            <Spinner />
          ) : (
            <Switch
              checked={config.autoReduceOverAllocation}
              onChange={async () => {
                try {
                  await setConfigMutation({
                    variables: {
                      key: ConfigKey.AutoReduceAllocationEnabled,
                      value: config.autoReduceOverAllocation ? 'false' : 'true',
                    },
                  });
                  openNotification({
                    type: 'success',
                    title: `Auto Reduce Over Allocation ${
                      config.autoReduceOverAllocation ? 'Disabled' : 'Enabled'
                    }`,
                    duration: 3,
                  });
                  setConfig({
                    ...config,
                    autoReduceOverAllocation: !config.autoReduceOverAllocation,
                  });
                } catch (e) {
                  openNotification({
                    type: 'error',
                    title: 'Failed to update config',
                    description: (e as any)?.message,
                    duration: 3,
                  });
                }
              }}
            />
          )}
        </div>
        <Typography variant="medium" type="secondary" style={{ maxWidth: 807 }}>
          By enabling the &quot;Auto Reduce Over Allocation&quot; feature, this will automatically
          detect when your allocation amount exceeds your available stake. This feature ensures that
          over-allocations are evenly reduced across all projects, helping to maintain balanced
          resource distribution. By doing so, it helps operators avoid 0 rewards or burned rewards.
        </Typography>

        <div>
          <Button type="primary" shape="round">
            <a
              href="https://app.subquery.network/indexer/my-projects"
              target="_blank"
              rel="noreferrer"
            >
              View Your Allocation On Explorer
            </a>
          </Button>
        </div>
      </Wrapper>

      <Wrapper>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Default Flex Plan</Typography>
          </div>

          {config.flexEnabled && (
            <>
              <Form form={form}>
                <SubqlInput style={{ display: 'flex' }}>
                  <Form.Item
                    label={
                      <div
                        style={{
                          height: '100%',
                          fontSize: 16,
                          lineHeight: '46px',
                          width: 100,
                          textAlign: 'left',
                        }}
                      >
                        Price ratio:{' '}
                      </div>
                    }
                    colon={false}
                    style={{ display: 'flex', alignItems: 'center' }}
                    name="priceRatio"
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (!value) {
                            return Promise.reject(new Error('Please input price ratio'));
                          }
                          if (value <= 0) {
                            return Promise.reject(new Error('Price ratio must be greater than 0'));
                          }
                          if (BigNumberJs(value).isGreaterThan(100)) {
                            return Promise.reject(new Error('Price ratio must be less than 100'));
                          }
                          if (!Number.isInteger(+value)) {
                            return Promise.reject(new Error('Price ratio must be integer'));
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input
                      style={{ width: 300, marginLeft: 10 }}
                      type="number"
                      suffix={
                        <Typography type="secondary" style={{ color: 'var(--sq-gray500)' }}>
                          %
                        </Typography>
                      }
                    />
                  </Form.Item>
                  <Tooltip title="Price Ratio is the ratio between your set acceptable price range and the price set by the main consumers in the market, used to measure the relationship between your pricing and market expectations. If the calculated result falls below your set minimum acceptable price, that minimum price will be used as the final price.">
                    <InfoCircleOutlined
                      style={{
                        color: 'var(--sq-gray500)',
                        height: '48px',
                        fontSize: 18,
                        marginLeft: 10,
                      }}
                    />
                  </Tooltip>
                </SubqlInput>

                <SubqlInput style={{ display: 'flex', gap: 4 }}>
                  <Form.Item
                    label={
                      <div
                        style={{
                          height: '100%',
                          fontSize: 16,
                          lineHeight: '46px',
                          width: 100,
                          textAlign: 'left',
                        }}
                      >
                        Minimum price:
                      </div>
                    }
                    colon={false}
                    style={{ display: 'flex', alignItems: 'center' }}
                    name="price"
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (!value) {
                            return Promise.reject(new Error('Please input price'));
                          }
                          if (value <= 0) {
                            return Promise.reject(new Error('Price must be greater than 0'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input
                      style={{ width: 300, marginLeft: 10 }}
                      type="number"
                      addonAfter={
                        <Select
                          value={form.getFieldValue('flexTokenAddress')}
                          onChange={(e) => {
                            form.setFieldValue('flexTokenAddress', e);
                            update();
                          }}
                          options={[
                            {
                              value: STABLE_COIN_ADDRESS,
                              label: (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <img
                                    style={{ width: 24, height: 24, marginRight: 8 }}
                                    src="/images/usdc.png"
                                    alt=""
                                  />
                                  <Typography>USDC</Typography>
                                </div>
                              ),
                            },
                            {
                              value: sdk?.sqToken?.address,
                              label: (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <img
                                    style={{
                                      width: 24,
                                      height: 24,
                                      marginRight: 8,
                                      borderRadius: '50%',
                                      overflow: 'hidden',
                                    }}
                                    src="/images/sqt.png"
                                    alt=""
                                  />
                                  <Typography>{TOKEN_SYMBOL}</Typography>
                                </div>
                              ),
                            },
                          ]}
                        />
                      }
                    />
                  </Form.Item>
                  <div
                    style={{
                      maxWidth: 807,
                      color: 'var(--sq-gray500)',
                      lineHeight: '48px',
                      marginLeft: 10,
                    }}
                  >
                    / 1000 requests
                  </div>
                </SubqlInput>
                <SubqlInput style={{ display: 'none' }}>
                  <Form.Item
                    label={
                      <div
                        style={{
                          height: '100%',
                          fontSize: 16,
                          lineHeight: '46px',
                          width: 100,
                          textAlign: 'left',
                        }}
                      >
                        Valid period:{' '}
                      </div>
                    }
                    name="validPeriod"
                    colon={false}
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (!value) {
                            return Promise.reject(new Error('Please input valid period'));
                          }

                          if (value < 1) {
                            return Promise.reject(new Error('Valid period must be greater than 1'));
                          }

                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input
                      style={{ width: 300 }}
                      type="number"
                      suffix={
                        <Typography type="secondary" style={{ color: 'var(--sq-gray500)' }}>
                          Day(s)
                        </Typography>
                      }
                    />
                  </Form.Item>
                </SubqlInput>
              </Form>

              <div>
                <Button
                  type="primary"
                  shape="round"
                  onClick={async () => {
                    await form.validateFields();
                    try {
                      const isSQT = form.getFieldValue('flexTokenAddress') === sdk?.sqToken.address;
                      await setConfigMutation({
                        variables: {
                          key: ConfigKey.FlexPrice,
                          value: parseUnits(
                            BigNumberJs(form.getFieldValue('price') || 1)
                              .dividedBy(1000)
                              .toString(),
                            isSQT ? SQT_DECIMAL : STABLE_COIN_DECIMAL[SUPPORTED_NETWORK]
                          ).toString(),
                        },
                      });
                      await setConfigMutation({
                        variables: {
                          key: ConfigKey.FlexValidPeriod,
                          value: BigNumberJs(form.getFieldValue('validPeriod') || 3).multipliedBy(
                            86400
                          ),
                        },
                      });
                      await setConfigMutation({
                        variables: {
                          key: ConfigKey.FlexPriceRatio,
                          value: BigNumberJs(form.getFieldValue('priceRatio') || 80),
                        },
                      });
                      await setConfigMutation({
                        variables: {
                          key: ConfigKey.FlexTokenAddress,
                          value: form.getFieldValue('flexTokenAddress'),
                        },
                      });
                      openNotification({
                        type: 'success',
                        title: 'Config Updated',
                        duration: 3,
                      });
                    } catch (e) {
                      openNotification({
                        type: 'error',
                        title: 'Failed to update config',
                        description: (e as any)?.message,
                        duration: 3,
                      });
                    }
                  }}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </Wrapper>

      <Wrapper>
        {socialCredibility.loading || loading ? (
          <Spinner />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Link your ENS domain to enable social credibility
              </Typography>

              <Tag color={socialCredibility.data ? 'success' : 'default'}>
                Social Credibility {socialCredibility.data ? 'Enabled' : 'Disabled'}
              </Tag>
            </div>
            <Typography variant="medium" type="secondary">
              We suggest you also setup your Social Profile so Delegators can get to know you, and
              so you can show social credibility. To setup social credibility, create an ENS domain
              name and profile linked to your wallet.
            </Typography>

            <div>
              <Typography.Link href="https://app.ens.domains/" target="_blank">
                <Button
                  shape="round"
                  type="primary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Setup ENS
                  <BsBoxArrowInUpRight />
                </Button>
              </Typography.Link>
            </div>
          </>
        )}
      </Wrapper>
    </div>
  );
};

export default GlobalConfig;
