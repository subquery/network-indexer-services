// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useMemo } from 'react';
import { useParams } from 'react-router';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { Spinner, Steps, Typography } from '@subql/components';
import { cidToBytes32 } from '@subql/network-clients';
import { Button, Form, Input, InputNumber } from 'antd';
import { Rule } from 'antd/es/form';
import debounce from 'debounce-promise';
import { merge } from 'lodash';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { useProjectDetails } from 'hooks/projectHook';
import { GET_RPC_ENDPOINT_KEYS, START_PROJECT, VALID_RPC_ENDPOINT } from 'utils/queries';

interface IProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  id?: string;
}

const RpcSetting: FC<IProps> = (props) => {
  const { onCancel, onSubmit, id: propsId } = props;

  const { id } = useParams() as { id: string };
  const mineId = useMemo(() => propsId || id, [propsId, id]);
  const projectQuery = useProjectDetails(mineId);
  const [form] = Form.useForm();

  const keys = useQuery<{ getRpcEndpointKeys: string[] }>(GET_RPC_ENDPOINT_KEYS, {
    variables: {
      projectId: mineId,
    },
  });

  const rules = useMemo(() => {
    const checkIfWsAndHttpSame = () => {
      const allValues = keys.data?.getRpcEndpointKeys.map((key) => {
        try {
          return new URL(form.getFieldValue(key)).hostname;
        } catch {
          return form.getFieldValue(key);
        }
      });

      const ifSame = new Set(allValues).size === 1;

      if (ifSame)
        return {
          result: true,
        };

      return {
        result: false,
        message: 'The origin of Ws and Http endpoint should be the same.',
      };
    };

    const polkadotAndSubstrateRule = (
      endpointType: 'http' | 'ws',
      value: string,
      ruleField: string
    ) => {
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

    return {
      evm: (endpointType: 'http' | 'ws', value: string, ruleField: string) => {
        if (endpointType === 'ws') {
          const wsVal = form.getFieldValue(ruleField.replace('Http', 'Ws'));
          if (wsVal && wsVal?.startsWith('ws')) {
            return checkIfWsAndHttpSame();
          }

          return {
            result: true,
          };
        }
        if (value.startsWith('http'))
          return {
            result: true,
          };

        return {
          result: false,
          message: 'Please input a valid endpoint',
        };
      },
      polkadot: polkadotAndSubstrateRule,
      substrate: polkadotAndSubstrateRule,
    };
  }, [form, keys.data?.getRpcEndpointKeys]);

  const [validate] = useLazyQuery<
    { validateRpcEndpoint: { valid: boolean; reason?: string } },
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
      const whichRule =
        rules[
          ruleKeys.find((key) => ruleField.includes(key as string)) as
            | 'evm'
            | 'polkadot'
            | 'substrate'
        ];
      const { result, message } = whichRule(
        ruleField.toLocaleLowerCase().includes('http') ? 'http' : 'ws',
        value,
        ruleField
      );

      if (!result) {
        return Promise.reject(new Error(message));
      }

      // whichRule should validate if the field can be empty, if empty, just true
      if (!value) return Promise.resolve();

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

      if (!res?.data?.validateRpcEndpoint.valid) {
        return Promise.reject(new Error(res?.data?.validateRpcEndpoint.reason));
      }
      // verification RPC endpoint
      return Promise.resolve();
    };

    return keys.data?.getRpcEndpointKeys.reduce((acc, key) => {
      return {
        ...acc,
        [key]: debounce(validateFunc, 1000),
      };
    }, {}) as Record<string, (rule: Rule, value: string) => Promise<void> | void>;
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
              <Form.Item
                key={key}
                label={`${key} Endpoint`}
                name={`${key}`}
                hasFeedback
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
            );
          })}
          <HorizeFormItem>
            <Form.Item
              label="Rate Limit"
              tooltip="This feature allows you to manage and set rate limits for your Flex Plan, helping you optimize service stability and performance"
              name="rateLimit"
            >
              <InputNumber />
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
          onClick={async () => {
            await form.validateFields();
            const serviceEndpoints = keys.data?.getRpcEndpointKeys
              .map((key) => {
                return {
                  key,
                  value: form.getFieldValue(`${key}`)?.trim(),
                };
              })
              .filter((i) => i.value);

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

export default RpcSetting;
