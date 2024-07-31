// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useState } from 'react';
import { PlusCircleOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@apollo/client';
import { Modal, openNotification, Typography } from '@subql/components';
import { Button, Collapse, Form, Input, Table } from 'antd';
import { useForm } from 'antd/es/form/Form';

import {
  ADD_INTEGRATION,
  GET_ALL_INTEGRATION,
  IGetAllIntegration,
  REMOVE_INTEGRATION,
  REMOVE_MODEL,
} from 'utils/queries';

const OllamaServer: FC = () => {
  const [open, setOpen] = useState(false);
  const [form] = useForm();

  const [addIntegration] = useMutation(ADD_INTEGRATION);
  const [removeModel] = useMutation(REMOVE_MODEL);
  const [removeIntegration] = useMutation(REMOVE_INTEGRATION);
  const allIntegration = useQuery<IGetAllIntegration>(GET_ALL_INTEGRATION);

  const addServer = async () => {
    await form.validateFields();

    try {
      const res = await addIntegration({
        variables: {
          ...form.getFieldsValue(),
        },
      });

      if (res.data?.addIntegration?.id) {
        await allIntegration.refetch();

        openNotification({
          title: 'Success',
          duration: 3,
          type: 'success',
        });
        form.resetFields();
        setOpen(false);
        return;
      }
    } catch (e) {
      openNotification({
        title: 'Error',
        description: (e as string).toString(),
        type: 'error',
        duration: 3,
      });
    }
  };

  const removeServerModel = async (id: number | string, name: string) => {
    await Modal.confirm({
      title: 'Are you sure you want to remove this model?',
      onOk: async () => {
        try {
          const res = await removeModel({
            variables: {
              id: +id,
              modelName: name,
            },
          });

          if (res.data?.deleteModel?.id) {
            await allIntegration.refetch();

            openNotification({
              title: 'Success',
              duration: 3,
              type: 'success',
            });
          }
        } catch (e) {
          openNotification({
            title: 'Error',
            description: (e as string).toString(),
            type: 'error',
            duration: 3,
          });
        }
      },
    });
  };

  const removeServerIntegration = async (id: number | string) => {
    await Modal.confirm({
      title: 'Are you sure you want to remove this server?',
      onOk: async () => {
        try {
          const res = await removeIntegration({
            variables: {
              id: +id,
            },
          });

          if (res.data?.deleteIntegration) {
            await allIntegration.refetch();

            openNotification({
              title: 'Success',
              duration: 3,
              type: 'success',
            });
          }
        } catch (e) {
          openNotification({
            title: 'Error',
            description: (e as string).toString(),
            type: 'error',
            duration: 3,
          });
        }
      },
    });
  };

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
      <Typography variant="h4">LLM server</Typography>

      {allIntegration.data?.allIntegration.length ? (
        <Collapse>
          {allIntegration.data?.allIntegration.map((integration) => {
            return (
              <Collapse.Panel
                id={integration.id}
                header={
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      height: 24,
                    }}
                  >
                    <Typography>
                      {integration.serviceEndpoints?.[0]?.key}{' '}
                      {integration.serviceEndpoints?.[0]?.value}
                    </Typography>

                    <Button
                      type="text"
                      danger
                      onClick={() => {
                        removeServerIntegration(integration.id);
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                }
                key={integration.id}
              >
                <Table
                  columns={[
                    {
                      key: 'name',
                      title: 'Name',
                      dataIndex: 'name',
                    },
                    {
                      key: 'status',
                      title: 'Status',
                      dataIndex: 'status',
                    },
                    {
                      key: 'action',
                      title: 'Action',
                      render: (_, record) => {
                        return (
                          <Button
                            danger
                            onClick={() => {
                              removeServerModel(integration.id, record.name);
                            }}
                          >
                            Remove
                          </Button>
                        );
                      },
                    },
                  ]}
                  dataSource={integration.models}
                />
              </Collapse.Panel>
            );
          })}
        </Collapse>
      ) : (
        ''
      )}

      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderRadius: 8,
          border: '1px solid var(--sq-gray300)',
          background: '#fff',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
        role="button"
        tabIndex={0}
        onClick={() => {
          setOpen(true);
        }}
      >
        <PlusCircleOutlined />
      </div>

      <Modal
        footer={
          <Button
            type="primary"
            shape="round"
            size="middle"
            onClick={() => {
              addServer();
            }}
          >
            Add
          </Button>
        }
        open={open}
        onCancel={() => {
          setOpen(false);
        }}
        title="Add LLM Server"
      >
        <Form layout="vertical" form={form}>
          <Form.Item label="Server Name" rules={[{ required: true }]} name="name">
            <Input />
          </Form.Item>
          <Form.Item label="Server Endpoint" rules={[{ required: true }]} name="url">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
export default OllamaServer;
