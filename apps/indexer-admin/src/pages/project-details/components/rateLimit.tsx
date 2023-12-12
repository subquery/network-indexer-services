// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useState } from 'react';
import { useMutation } from '@apollo/client';
import { TableTitle, Typography } from '@subql/components';
import { Button, Input, Modal, Table } from 'antd';
import { isUndefined } from 'lodash';
import { SubqlInput } from 'styles/input';

import { notificationMsg } from 'containers/notificationContext';
import { parseError } from 'utils/error';
import { UPDATE_RATE_LIMIT } from 'utils/queries';

import { ProjectDetails } from '../types';

interface IProps {
  id: string;
  project: ProjectDetails;
  refreshProject: () => void;
}

const RateLimit: FC<IProps> = (props) => {
  const { id, project, refreshProject } = props;

  const [updateRateLimitMutation] = useMutation<{
    updateProjectRateLimit: { rateLimit: number };
  }>(UPDATE_RATE_LIMIT);

  const [openChangeModal, setOpenChangeModal] = useState(false);
  const [rateLimit, setRateLimit] = useState<string>(`${project.rateLimit || ''}`);
  const [updateLoading, setUpdateLoading] = useState(false);
  const updateLimit = async () => {
    if (isUndefined(rateLimit)) return;
    try {
      setUpdateLoading(true);
      const res = await updateRateLimitMutation({
        variables: {
          id,
          rateLimit: +rateLimit,
        },
      });

      if (!res.errors) {
        await refreshProject();
        notificationMsg({
          type: 'success',
          title: 'Update Success',
          message: 'Rate Limit update success',
          dismiss: {
            duration: 3000,
          },
        });
        setOpenChangeModal(false);
      }
    } catch (e) {
      parseError(e, {
        alert: true,
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <div>
      {!project.rateLimit ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 73,
            gap: 16,
          }}
        >
          <Typography variant="h4">Rate Limit</Typography>
          <Typography type="secondary" style={{ maxWidth: 409, textAlign: 'center' }}>
            This feature allows you to manage and set rate limits for your agreement service and
            Flex Plan, helping you optimize service stability and performance.
          </Typography>
          <Button
            type="primary"
            shape="round"
            size="large"
            onClick={() => {
              setOpenChangeModal(true);
            }}
          >
            Configure Rate Limit
          </Button>
        </div>
      ) : (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h5">Rate Limit</Typography>
          <Table
            pagination={false}
            dataSource={[
              {
                rateLimit: project.rateLimit,
                key: 'Rate Limit',
              },
            ]}
            columns={[
              {
                title: <TableTitle>Rate Limit</TableTitle>,
                dataIndex: 'rateLimit',
                render: (val) => <Typography variant="medium">{val} requests/sec</Typography>,
              },
              {
                title: <TableTitle>Action</TableTitle>,
                dataIndex: 'rateLimit',
                render: () => (
                  <Button
                    type="link"
                    onClick={() => {
                      setOpenChangeModal(true);
                    }}
                  >
                    Edit
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}

      <Modal
        open={openChangeModal}
        onCancel={() => {
          setOpenChangeModal(false);
        }}
        onOk={() => {
          updateLimit();
        }}
        title="Configure Rate Limit"
        okText="Configure"
        cancelButtonProps={{
          shape: 'round',
          size: 'large',
        }}
        okButtonProps={{
          shape: 'round',
          size: 'large',
          loading: updateLoading,
        }}
      >
        <div style={{ padding: '24px 8px' }}>
          <Typography style={{ marginBottom: 6 }}>Requests allowed per second</Typography>
          <SubqlInput>
            <Input
              value={rateLimit}
              onChange={(e) => {
                setRateLimit(e.target.value);
              }}
              type="number"
              suffix="per second"
              placeholder="Enter requests"
            />
          </SubqlInput>
        </div>
      </Modal>
    </div>
  );
};
export default RateLimit;
