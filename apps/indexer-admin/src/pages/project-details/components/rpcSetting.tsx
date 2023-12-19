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

  const [validate] = useLazyQuery<
    { validateRpcEndpoint: { valid: boolean; reason?: string } },
    { projectId: string; endpointKey: string; endpoint: string }
  >(VALID_RPC_ENDPOINT);

  const [startProjectRequest] = useMutation(START_PROJECT);

  const debouncedValidator = useMemo(() => {
    return debounce(async (rule: Rule, value: string) => {
      if (!value) return Promise.reject(new Error('Please input http endpoint'));
      const res = await validate({
        variables: {
          projectId: mineId,
          endpoint: value,
          // not sure if it's a development field or not.
          // when print it, the rule actrully is { field, fullField, type }
          // @ts-ignore
          endpointKey: rule.field,
        },
        defaultOptions: {
          fetchPolicy: 'network-only',
        },
      });

      if (!res?.data?.validateRpcEndpoint.valid) {
        return Promise.reject(new Error(res?.data?.validateRpcEndpoint.reason));
      }
      // verification RPC endpoint
      if (value) {
        return Promise.resolve();
      }

      return Promise.reject(new Error('xxxx'));
    }, 3000);
  }, [validate, mineId]);

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
            {},
            ...projectQuery.data.project.projectConfig.serviceEndpoints.map((val) => {
              return {
                [`${val.key}Endpoint`]: val.value,
              };
            })
          )}
        >
          {keys.data?.getRpcEndpointKeys.map((key) => {
            return (
              <Form.Item
                key={key}
                label={`${key} Endpoint`}
                name={`${key}Endpoint`}
                hasFeedback
                rules={[
                  () => {
                    return {
                      validator: debouncedValidator,
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
              tooltip="This feature allows you to manage and set rate limits for your agreement service and Flex Plan, helping you optimize service stability and performance"
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
            const serviceEndpoints = keys.data?.getRpcEndpointKeys.map((key) => {
              return {
                key,
                value: form.getFieldValue(`${key}Endpoint`),
              };
            });
            await startProjectRequest({
              variables: {
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

const HorizeFormItem = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  .ant-row {
    flex-direction: row;
    align-items: center;
    .ant-col {
      width: auto;
    }
  }
`;

export default RpcSetting;