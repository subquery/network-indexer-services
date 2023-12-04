// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC } from 'react';
import { useParams } from 'react-router';
import { Steps, Typography } from '@subql/components';
import { cidToBytes32 } from '@subql/network-clients';
import { useUpdate } from 'ahooks';
import { Button, Form, Input } from 'antd';

import Avatar from 'components/avatar';
import { useProjectDetails } from 'hooks/projectHook';

interface IProps {
  onSubmit: () => void;
  onCancel: () => void;
}

const RpcSetting: FC<IProps> = (props) => {
  const { onCancel, onSubmit } = props;
  const { id } = useParams() as { id: string };
  const projectQuery = useProjectDetails(id);
  const [form] = Form.useForm();

  const update = useUpdate();

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
        <Avatar address={projectQuery.data?.project.details.image || cidToBytes32(id)} size={40} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <Typography>{projectQuery.data?.project.details.name}</Typography>
          <Typography variant="small" type="secondary">
            RPC Service
          </Typography>
        </div>
      </div>

      <Typography style={{ marginTop: 24 }}>Please provide the connect settings.</Typography>

      <div style={{ margin: '16px 0' }}>
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Http Endpoint"
            name="httpEndpoint"
            hasFeedback
            rules={[
              () => {
                return {
                  validator: async (_, value) => {
                    if (!value) return Promise.reject(new Error('Please input http endpoint'));
                    // verification RPC endpoint
                    if (value) {
                      return Promise.resolve();
                    }

                    return Promise.reject(new Error('xxxx'));
                  },
                };
              },
            ]}
          >
            <Input />
          </Form.Item>
        </Form>
      </div>
      <div style={{ flex: 1 }} />

      <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
        <Button
          shape="round"
          onClick={() => {
            onCancel();
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
            // onSubmit();
          }}
        >
          Update
        </Button>
      </div>
    </div>
  );
};
export default RpcSetting;
