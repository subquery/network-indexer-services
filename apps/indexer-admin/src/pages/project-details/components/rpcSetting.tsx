// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useMemo } from 'react';
import { useParams } from 'react-router';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { Spinner, Steps, Typography } from '@subql/components';
import { cidToBytes32 } from '@subql/network-clients';
import { useUpdate } from 'ahooks';
import { Button, Form, Input, InputNumber } from 'antd';
import { Rule } from 'antd/es/form';
import debounce from 'debounce-promise';
import { merge } from 'lodash';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { useProjectDetails } from 'hooks/projectHook';
import { parseError } from 'utils/error';
import { GET_RPC_ENDPOINT_KEYS, START_PROJECT, VALID_RPC_ENDPOINT } from 'utils/queries';

interface IProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  id?: string;
}

export const getKeyName = (keyName: string) => {
  if (keyName.includes('Metrics')) {
    return 'Metrics' as const;
  }

  if (keyName.includes('Ws')) {
    return 'WebSocket' as const;
  }

  if (keyName.includes('Http')) {
    return 'HTTP' as const;
  }
  return keyName;
};

const getRuleField = (key: string) => {
  const lowerCaseKey = key.toLowerCase();

  if (lowerCaseKey.includes('metrics')) {
    return 'metrics';
  }

  if (lowerCaseKey.includes('http')) {
    return 'http';
  }

  return 'ws';
};

const RpcSetting: FC<IProps> = (props) => {
  const { onCancel, onSubmit, id: propsId } = props;

  const { id } = useParams() as { id: string };
  const mineId = useMemo(() => propsId || id, [propsId, id]);
  const projectQuery = useProjectDetails(mineId);
  const [form] = Form.useForm();
  const update = useUpdate();
  const [loadingUpdate, setLoadingUpdate] = React.useState(false);
  const inputFieldFeedback = React.useRef<{
    [key in string]: 'warn' | 'error' | 'success' | 'validating' | '';
  }>({});

  const keys = useQuery<{ getRpcEndpointKeys: string[] }>(GET_RPC_ENDPOINT_KEYS, {
    variables: {
      projectId: mineId,
    },
  });

  const rules = useMemo(() => {
    const checkIfWsAndHttpSame = () => {
      const allValues = keys.data?.getRpcEndpointKeys
        .map((key) => {
          try {
            return {
              key,
              val: new URL(form.getFieldValue(key)).hostname,
            };
          } catch {
            return {
              key,
              val: form.getFieldValue(key),
            };
          }
        })
        .filter((i) => i.val);

      if ((allValues?.length || 0) < 2) {
        return {
          result: false,
          message: 'Please input endpoint',
        };
      }

      const ifSame = new Set(allValues?.map((i) => i.val)).size === 1;

      if (ifSame)
        return {
          result: true,
        };

      return {
        result: false,
        message: 'The origin of all endpoint should be the same.',
      };
    };

    const polkadotAndSubstrateRule = (
      endpointType: 'http' | 'ws' | 'metrics',
      value: string,
      ruleField: string
    ) => {
      if (endpointType === 'metrics') {
        if (value) {
          return checkIfWsAndHttpSame();
        }

        return {
          result: true,
        };
      }

      if (endpointType === 'ws') {
        if (!value)
          return {
            result: false,
            message: 'Please input the endpoint',
          };
        if (!value.startsWith('ws'))
          return {
            result: false,
            message: 'Please input a valid endpoint',
          };

        const httpVal = form.getFieldValue(ruleField.replace('Ws', 'Http'));

        if (httpVal) {
          return checkIfWsAndHttpSame();
        }

        return {
          result: true,
        };
      }

      if (endpointType === 'http') {
        if (value && value?.trim()) {
          if (value?.startsWith('http')) {
            return checkIfWsAndHttpSame();
          }

          return {
            result: false,
            message: 'Please input a valid endpoint',
          };
        }

        return {
          result: false,
          message: 'Please input a endpoint',
        };
      }

      return {
        result: true,
      };
    };

    const evmAndDataNodeRule = (
      endpointType: 'http' | 'ws' | 'metrics',
      value: string,
      ruleField: string
    ) => {
      if (endpointType === 'metrics') {
        const metricsVal = form.getFieldValue(ruleField);

        if (metricsVal) {
          return checkIfWsAndHttpSame();
        }

        return {
          result: true,
        };
      }

      if (endpointType === 'ws') {
        const wsVal = form.getFieldValue(ruleField.replace('Http', 'Ws'));
        if (wsVal && wsVal?.startsWith('ws')) {
          return checkIfWsAndHttpSame();
        }

        if (wsVal && !wsVal?.startsWith('ws')) {
          return {
            result: false,
            message: 'Please input a valid endpoint',
          };
        }

        return {
          result: true,
        };
      }
      if (value?.startsWith('http'))
        return {
          result: true,
        };

      return {
        result: false,
        message: 'Please input a valid endpoint',
      };
    };

    return {
      evm: evmAndDataNodeRule,
      polkadot: polkadotAndSubstrateRule,
      substrate: polkadotAndSubstrateRule,
      subql_dict: evmAndDataNodeRule,
    };
  }, [form, keys.data?.getRpcEndpointKeys]);

  const [validate] = useLazyQuery<
    { validateRpcEndpoint: { valid: boolean; reason?: string; level: 'warn' | 'error' | '' } },
    { projectId: string; endpointKey: string; endpoint: string }
  >(VALID_RPC_ENDPOINT);

  const [startProjectRequest] = useMutation(START_PROJECT);

  const debouncedValidator = useMemo(() => {
    // if more than one field, the debounce will be shared
    const validateFunc = async (rule: Rule, value: string) => {
      // not sure if it's a development field or not.
      // when print it, the rule actrully is { field, fullField, type }
      // @ts-ignore
      const ruleField = rule.field as string;
      const ruleKeys = Object.keys(rules);

      inputFieldFeedback.current = {
        ...inputFieldFeedback.current,
        [ruleField]: 'validating',
      };
      update();

      const whichRule =
        rules[
          ruleKeys.find((key) => ruleField.includes(key as string)) as
            | 'evm'
            | 'polkadot'
            | 'substrate'
        ];

      const { result, message } = whichRule(getRuleField(ruleField), value, ruleField);

      if (!result) {
        inputFieldFeedback.current = {
          ...inputFieldFeedback.current,
          [ruleField]: 'error',
        };
        update();
        return Promise.reject(new Error(message));
      }

      // whichRule should validate if the field can be empty, if empty, just true
      if (!value) {
        inputFieldFeedback.current = {
          ...inputFieldFeedback.current,
          [ruleField]: 'success',
        };
        update();
        return Promise.resolve();
      }

      const res = await validate({
        variables: {
          projectId: mineId,
          endpoint: value,
          endpointKey: ruleField,
        },
        defaultOptions: {
          fetchPolicy: 'network-only',
        },
      });
      inputFieldFeedback.current = {
        ...inputFieldFeedback.current,
        [ruleField]: res?.data?.validateRpcEndpoint.level || '',
      };
      update();
      if (!res?.data?.validateRpcEndpoint.valid) {
        return Promise.reject(new Error(res?.data?.validateRpcEndpoint.reason));
      }

      inputFieldFeedback.current = {
        ...inputFieldFeedback.current,
        [ruleField]: 'success',
      };
      update();
      // verification RPC endpoint
      return Promise.resolve();
    };

    return keys.data?.getRpcEndpointKeys.reduce((acc, key) => {
      return {
        ...acc,
        [key]: debounce(validateFunc, 1000),
      };
    }, {}) as Record<string, (rule: Rule, value: string) => Promise<void> | void>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validate, mineId, rules, keys.data?.getRpcEndpointKeys]);

  if (!projectQuery.data) return <Spinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Steps
        steps={[
          {
            title: 'Deployment ID',
            status: 'finish',
          },
          {
            title: 'Deployment Settings',
            status: 'process',
          },
        ]}
      />

      <Typography style={{ marginTop: 24, marginBottom: 8 }}>Project Detail</Typography>

      <div
        style={{
          display: 'flex',
          borderRadius: 8,
          border: '1px solid var(--sq-gray300)',
          padding: 16,
          background: 'rgba(67, 136, 221, 0.05)',
          gap: 12,
        }}
      >
        <Avatar
          address={projectQuery.data?.project.details.image || cidToBytes32(mineId)}
          size={40}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Typography>{projectQuery.data?.project.details.name}</Typography>
          <Typography variant="small" type="secondary">
            RPC Service
          </Typography>
        </div>
      </div>

      <Typography style={{ marginTop: 24 }}>Please provide the connect settings.</Typography>

      <div style={{ margin: '16px 0' }}>
        <Form
          layout="vertical"
          form={form}
          initialValues={merge(
            {
              rateLimit: projectQuery.data.project.rateLimit,
            },
            ...projectQuery.data.project.projectConfig.serviceEndpoints.map((val) => {
              return {
                [`${val.key}`]: val.value,
              };
            })
          )}
        >
          {keys.data?.getRpcEndpointKeys.map((key) => {
            return (
              <WithWarning key={key}>
                <Form.Item
                  key={key}
                  label={`${getKeyName(key)} Endpoint`}
                  name={`${key}`}
                  hasFeedback
                  className={
                    inputFieldFeedback.current[key] === 'warn' ? 'ant-form-item-has-warning' : ''
                  }
                  validateStatus={
                    ({
                      warn: 'warning',
                      error: 'error',
                      success: 'success',
                      '': 'success',
                      validating: 'validating',
                    }[inputFieldFeedback.current[key]] as 'warning' | 'error' | 'success') || ''
                  }
                  rules={[
                    () => {
                      return {
                        validator: debouncedValidator[key],
                      };
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
              </WithWarning>
            );
          })}
          <HorizeFormItem>
            <Form.Item
              label="Rate Limit"
              tooltip="This feature allows you to manage and set rate limits for your Flex Plan, helping you optimize service stability and performance"
              name="rateLimit"
            >
              <InputNumber min="0" />
            </Form.Item>
            <Typography style={{ marginBottom: 24 }}>Requests/sec</Typography>
          </HorizeFormItem>
        </Form>
      </div>
      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
        <Button
          shape="round"
          onClick={() => {
            onCancel?.();
          }}
        >
          Back
        </Button>
        <Button
          shape="round"
          type="primary"
          style={{ borderColor: 'var(--sq-blue600)', background: 'var(--sq-blue600)' }}
          loading={loadingUpdate}
          onClick={async () => {
            try {
              setLoadingUpdate(true);
              try {
                await form.validateFields();
              } catch (e: any) {
                // ValidateErrorEntity
                if (e?.errorFields && Array.isArray(e.errorFields)) {
                  // eslint-disable-next-line no-restricted-syntax
                  for (const err of e.errorFields) {
                    const name = err?.name?.[0] as string;
                    if (inputFieldFeedback.current[name] !== 'warn') {
                      return;
                    }
                  }
                }
              }
              const serviceEndpoints = keys.data?.getRpcEndpointKeys
                .map((key) => {
                  return {
                    key,
                    value: form.getFieldValue(`${key}`)?.trim(),
                  };
                })
                .filter((i) => i.value);

              try {
                await startProjectRequest({
                  variables: {
                    rateLimit: form.getFieldValue('rateLimit'),
                    poiEnabled: false,
                    queryVersion: '',
                    nodeVersion: '',
                    networkDictionary: '',
                    networkEndpoints: '',
                    batchSize: 1,
                    workers: 1,
                    timeout: 1,
                    cache: 1,
                    cpu: 1,
                    memory: 1,
                    id: mineId,
                    projectType: projectQuery.data?.project.projectType,
                    serviceEndpoints,
                  },
                });
                onSubmit?.();
              } catch (e) {
                parseError(e, {
                  alert: true,
                  rawMsg: true,
                });
              }
            } finally {
              setLoadingUpdate(false);
            }
          }}
        >
          Update
        </Button>
      </div>
    </div>
  );
};

export const HorizeFormItem = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  .ant-row {
    flex-direction: row;
    align-items: center;
    .ant-col {
      width: auto;
    }

    .ant-form-item-label {
      padding: 0;
    }
  }
`;

const WithWarning = styled.div`
  .ant-form-item-has-warning {
    .ant-row {
      .ant-form-item-explain-error {
        color: var(--sq-warning);
      }
    }
  }
`;

export default RpcSetting;
