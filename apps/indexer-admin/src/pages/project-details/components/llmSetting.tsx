// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useMemo } from 'react';
import { useParams } from 'react-router';
import { useMutation, useQuery } from '@apollo/client';
import { Spinner, Steps, Typography } from '@subql/components';
import { cidToBytes32 } from '@subql/network-clients';
import { Button, Form, Select } from 'antd';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { useProjectDetails } from 'hooks/projectHook';
import { parseError } from 'utils/error';
import { GET_ALL_INTEGRATION, IGetAllIntegration, START_PROJECT } from 'utils/queries';

interface IProps {
  onSubmit?: () => void;
  onCancel?: () => void;
  id?: string;
}

const LlmSettings: FC<IProps> = (props) => {
  const { onCancel, onSubmit, id: propsId } = props;

  const { id } = useParams() as { id: string };
  const mineId = useMemo(() => propsId || id, [propsId, id]);
  const projectQuery = useProjectDetails(mineId);
  const [form] = Form.useForm();

  const allIntegration = useQuery<IGetAllIntegration>(GET_ALL_INTEGRATION);

  const [startProjectRequest] = useMutation(START_PROJECT);

  const options = useMemo(() => {
    return allIntegration.data?.allIntegration.map((i) => {
      return {
        label: i.serviceEndpoints?.[0]?.key,
        value: `${i.serviceEndpoints?.[0]?.key}======${i.serviceEndpoints?.[0]?.value}`,
      };
    });
  }, [allIntegration.data?.allIntegration]);

  const initialValues = useMemo(() => {
    const rateLimit = projectQuery.data?.project.rateLimit || 0;
    const serviceEndpoints = projectQuery.data?.project.projectConfig.serviceEndpoints || [];
    if (!serviceEndpoints?.length) return {};

    const { key, value } = serviceEndpoints[0];

    return {
      rateLimit,
      llmServer: `${key}======${value}`,
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
            Llm Project
          </Typography>
        </div>
      </div>

      <div style={{ margin: '16px 0' }}>
        <Form layout="vertical" form={form} initialValues={initialValues}>
          <Form.Item
            label="Llm Server"
            name="llmServer"
            required
            rules={[
              {
                required: true,
                message: 'Please select the llm server',
              },
            ]}
          >
            <Select>
              {options?.map((i) => {
                return (
                  <Select.Option key={i.label} value={i.value}>
                    {i.label}
                  </Select.Option>
                );
              })}
            </Select>
          </Form.Item>
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
            const [key, value] = form.getFieldValue('llmServer').split('======');
            try {
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
                  serviceEndpoints: [
                    {
                      key,
                      value,
                    },
                  ],
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

export default LlmSettings;
