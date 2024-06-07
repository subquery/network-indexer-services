// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useMemo } from 'react';
import { useParams } from 'react-router';
import { useLazyQuery, useMutation } from '@apollo/client';
import { Spinner, Steps, Typography } from '@subql/components';
import { cidToBytes32 } from '@subql/network-clients';
import { Button, Form, Input, InputNumber } from 'antd';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { useProjectDetails } from 'hooks/projectHook';
import { parseError } from 'utils/error';
import { GET_SUBGRAPH_ENDPOINTS, START_PROJECT } from 'utils/queries';

interface IProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  id?: string;
}

const SubGraphSetting: FC<IProps> = (props) => {
  const { onCancel, onSubmit, id: propsId } = props;

  const { id } = useParams() as { id: string };
  const mineId = useMemo(() => propsId || id, [propsId, id]);
  const projectQuery = useProjectDetails(mineId);
  const [form] = Form.useForm();

  const [getSubGraphEndpoints] = useLazyQuery<
    {
      getSubgraphEndpoints: {
        key: string;
        value: string;
        __typename: string;
      }[];
    },
    {
      cid: string;
      host: string;
      ports: { key: string; value: number }[];
    }
  >(GET_SUBGRAPH_ENDPOINTS);

  const [startProjectRequest] = useMutation(START_PROJECT);

  const initialValues = useMemo(() => {
    const rateLimit = projectQuery.data?.project.rateLimit || 0;
    const serviceEndpoints = projectQuery.data?.project.projectConfig.serviceEndpoints || [];
    if (!serviceEndpoints?.length) return {};

    const indexNodeEndpoint = serviceEndpoints.find((i) => i.key === 'index-node-endpoint');
    const httpEndpoint = serviceEndpoints.find((i) => i.key === 'http-endpoint');
    if (!indexNodeEndpoint || !httpEndpoint) return {};

    const host = new URL(indexNodeEndpoint.value).hostname;
    const indexNodePort = new URL(indexNodeEndpoint.value).port;
    const httpPort = new URL(httpEndpoint.value).port;

    return {
      rateLimit,
      host,
      indexNodePort: +indexNodePort,
      httpPort: +httpPort,
    };
  }, [projectQuery.data]);

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
            SubGraph Project
          </Typography>
        </div>
      </div>

      <Typography style={{ marginTop: 24 }}>Please provide the connect settings.</Typography>

      <div style={{ margin: '16px 0' }}>
        <Form layout="vertical" form={form} initialValues={initialValues}>
          <Form.Item
            label="Host"
            name="host"
            required
            rules={[
              {
                required: true,
                message: 'Please input the host',
              },
              {
                // should not start with http
                pattern: /^(?!http:\/\/|https:\/\/).*/,
                message: 'Please input a valid URL',
              },
            ]}
          >
            <Input placeholder="192.168.1.70" />
          </Form.Item>
          <Form.Item
            label="Index node port"
            name="indexNodePort"
            required
            rules={[
              {
                required: true,
                message: 'Please input the port',
              },
            ]}
          >
            <InputNumber min="1" max="65535" placeholder="8030" controls={false} />
          </Form.Item>
          <Form.Item
            label="Http port"
            name="httpPort"
            required
            rules={[
              {
                required: true,
                message: 'Please input the port',
              },
            ]}
          >
            <InputNumber min="1" max="65535" placeholder="8000" controls={false} />
          </Form.Item>
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
          onClick={async () => {
            await form.validateFields();

            try {
              const endpoints = await getSubGraphEndpoints({
                variables: {
                  host: form.getFieldValue('host'),
                  ports: [
                    {
                      key: 'index-node-port',
                      value: form.getFieldValue('indexNodePort'),
                    },
                    {
                      key: 'http-port',
                      value: form.getFieldValue('httpPort'),
                    },
                  ],
                  cid: mineId,
                },
                fetchPolicy: 'network-only',
              });
              if (endpoints.error) {
                throw new Error(endpoints.error.message);
              }

              await startProjectRequest({
                variables: {
                  rateLimit: form.getFieldValue('rateLimit') || 0,
                  poiEnabled: false,
                  queryVersion: '',
                  nodeVersion: '',
                  networkDictionary: '',
                  networkEndpoints: [],
                  batchSize: 1,
                  workers: 1,
                  timeout: 1,
                  cache: 1,
                  cpu: 1,
                  memory: 1,
                  id: mineId,
                  projectType: projectQuery.data?.project.projectType,
                  serviceEndpoints: endpoints.data?.getSubgraphEndpoints.map((i) => {
                    return {
                      key: i.key,
                      value: i.value,
                    };
                  }),
                },
              });
              onSubmit?.();
            } catch (e) {
              parseError(e, {
                alert: true,
                rawMsg: true,
              });
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

export default SubGraphSetting;
