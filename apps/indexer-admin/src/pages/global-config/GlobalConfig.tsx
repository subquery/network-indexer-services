// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { openNotification, Spinner, Typography } from '@subql/components';
import { formatSQT } from '@subql/react-hooks';
import { Button, Form, Input, Select, Switch } from 'antd';
import { useForm } from 'antd/es/form/Form';
import BigNumberJs from 'bignumber.js';
import { parseEther } from 'ethers/lib/utils';
import styled from 'styled-components';
import { SubqlInput } from 'styles/input';

import { useContractSDK } from 'containers/contractSdk';
import { AllConfig, ConfigKey, GET_ALL_CONFIG, SET_CONFIG } from 'utils/queries';
import { TOKEN_SYMBOL } from 'utils/web3';

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
  const [config, setConfig] = useState({
    autoReduceOverAllocation: false,
    flexEnabled: false,
  });
  const sdk = useContractSDK();

  const configQueryData = useQuery<AllConfig>(GET_ALL_CONFIG);
  const [setConfigMutation] = useMutation(SET_CONFIG);

  const [form] = useForm();

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
      const validPeriod = configQueryData.data.allConfig.find(
        (i) => i.key === ConfigKey.FlexValidPeriod
      );

      form.setFieldValue('price', BigNumberJs(formatSQT(price?.value || '0')).multipliedBy(1000));
      form.setFieldValue('validPeriod', BigNumberJs(validPeriod?.value || '0').dividedBy(86400));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQueryData.data, form]);

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

            {!configQueryData.previousData && configQueryData.loading ? (
              <Spinner />
            ) : (
              <Switch
                checked={config.flexEnabled}
                onChange={async () => {
                  try {
                    await setConfigMutation({
                      variables: {
                        key: ConfigKey.FlexEnabled,
                        value: config.flexEnabled ? 'false' : 'true',
                      },
                    });
                    openNotification({
                      type: 'success',
                      title: `Flex Plan ${config.flexEnabled ? 'Disabled' : 'Enabled'}`,
                      duration: 3,
                    });
                    setConfig({
                      ...config,
                      flexEnabled: !config.flexEnabled,
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
                        Price:{' '}
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
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input
                      style={{ width: 300 }}
                      type="number"
                      addonAfter={
                        <Select
                          value={sdk?.sqToken?.address}
                          // onChange={(e) => {}}
                          options={[
                            // {
                            //   value: STABLE_COIN_ADDRESS,
                            //   label: (
                            //     <div style={{ display: 'flex', alignItems: 'center' }}>
                            //       <img
                            //         style={{ width: 24, height: 24, marginRight: 8 }}
                            //         src="/images/usdc.png"
                            //         alt=""
                            //       />
                            //       <Typography>USDC</Typography>
                            //     </div>
                            //   ),
                            // },
                            {
                              value: sdk?.sqToken?.address,
                              label: (
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                  <img
                                    style={{ width: 24, height: 24, marginRight: 8 }}
                                    src="/images/ksqt.svg"
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
                <SubqlInput>
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
                      await setConfigMutation({
                        variables: {
                          key: ConfigKey.FlexPrice,
                          value: parseEther(
                            BigNumberJs(form.getFieldValue('price') || 1)
                              .dividedBy(1000)
                              .toString()
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
    </div>
  );
};

export default GlobalConfig;
