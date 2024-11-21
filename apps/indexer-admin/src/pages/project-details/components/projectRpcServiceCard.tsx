// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Tag, Typography } from '@subql/components';
import { Alert, Button, Drawer, Skeleton } from 'antd';

import { GET_RPC_ENDPOINT_KEYS } from 'utils/queries';

import { CardContainer } from '../styles';
import { ProjectDetails, ProjectStatus, TQueryMetadata } from '../types';
import RpcSetting, { getKeyName } from './rpcSetting';

type Props = {
  project: ProjectDetails;
  metadata?: TQueryMetadata;
  projectStatus: ProjectStatus;
  refresh: () => void;
};

const getEndpointStatus = (endpoint?: { valid: boolean }) => {
  if (!endpoint) {
    return {
      message: 'Not set',
      status: 'warning' as const,
    };
  }

  if (endpoint.valid) {
    return { message: 'Healthy', status: 'success' as const };
  }

  return { message: 'Error', status: 'error' as const };
};

const ProjectRpcServiceCard: FC<Props> = ({ project, metadata, projectStatus, refresh }) => {
  const [showRpcDrawer, setShowRpcDrawer] = useState(false);
  const keys = useQuery<{ getRpcEndpointKeys: string[] }>(GET_RPC_ENDPOINT_KEYS, {
    variables: {
      projectId: project.id,
    },
  });
  const rpcButtons = useMemo(() => {
    const btns = [];

    if (
      [
        ProjectStatus.NotIndexing,
        ProjectStatus.Indexing,
        ProjectStatus.Ready,
        ProjectStatus.Started,
        ProjectStatus.Starting,
        ProjectStatus.Unhealthy,
        ProjectStatus.Terminated,
      ].includes(projectStatus)
    ) {
      // update
      btns.push(
        <Button
          key="update"
          type="primary"
          onClick={() => {
            setShowRpcDrawer(true);
          }}
          shape="round"
          style={{ borderColor: 'var(--sq-blue600)', background: 'var(--sq-blue600)' }}
        >
          Update
        </Button>
      );
    }

    if (
      [
        ProjectStatus.Indexing,
        ProjectStatus.Ready,
        ProjectStatus.Started,
        ProjectStatus.Starting,
      ].includes(projectStatus)
    ) {
      // stop
      // btns.push(
      //   <Button
      //     type="primary"
      //     danger
      //     onClick={() => {
      //       setShowRpcDrawer(true);
      //     }}
      //     shape="round"
      //     style={{ borderColor: 'var(--sq-blue600)', background: 'var(--sq-blue600)' }}
      //   >
      //     Stop
      //   </Button>
      // );
    }

    return btns;
  }, [projectStatus]);

  const renderServicesEndpoints = useMemo(() => {
    return keys.data?.getRpcEndpointKeys.map((endpointName, index) => {
      const endpoint = project.serviceEndpoints.find((i) => i.key === endpointName);
      const status = getEndpointStatus(endpoint);
      return (
        <div style={{ display: 'flex', flexDirection: 'column' }} key={endpointName || index}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Typography type="secondary">{getKeyName(endpointName)}</Typography>
            <Tag color={status.status} style={{ marginLeft: 8 }}>
              {status.message}
            </Tag>
          </div>
          <Typography style={{ marginTop: 8 }} variant="medium">
            {endpoint?.value || 'N/A'}
          </Typography>
        </div>
      );
    });
  }, [keys.data, project.serviceEndpoints]);

  const renderServicesEndpointsFailed = useMemo(() => {
    const render = [];
    const metricStatus = project.serviceEndpoints.find((i) => getKeyName(i.key) === 'Metrics');

    if (!metricStatus) {
      render.push(
        <Alert
          showIcon
          style={{ background: '#F87C4F14', border: '1px solid #F87C4F80', width: '100%' }}
          key="metrics"
          type="warning"
          message={<Typography type="warning">Metrics Endpoint not set</Typography>}
          description={
            <Typography>
              You have not entered a valid metrics endpoint. You may receive fewer RPC requests
              without this set and active.{' '}
              <Typography.Link
                href="https://academy.subquery.network/subquery_network/node_operators/rpc_providers/connect-node.html#prerequisites"
                type="info"
                target="_blank"
              >
                Learn more.
              </Typography.Link>
            </Typography>
          }
        />
      );
    }

    if (metricStatus && !metricStatus.valid) {
      render.push(
        <Alert
          showIcon
          style={{ background: '#F87C4F14', border: '1px solid #F87C4F80', width: '100%' }}
          key="metricsFailed"
          type="warning"
          message={<Typography type="warning">Metrics Endpoint is not healthy</Typography>}
          description={
            <Typography>
              Your metrics endpoint cannot be reached. You may receive fewer RPC requests without a
              healthy metrics endpoint. <br />
              Please check: {metricStatus.reason}{' '}
              <Typography.Link
                href="https://academy.subquery.network/subquery_network/node_operators/rpc_providers/connect-node.html#prerequisites"
                type="info"
                target="_blank"
              >
                Learn more.
              </Typography.Link>
            </Typography>
          }
        />
      );
    }

    const failedEndpoints = project.serviceEndpoints.filter(
      (i) => !i.valid && getKeyName(i.key) !== 'Metrics'
    );

    if (failedEndpoints.length) {
      render.unshift(
        <Alert
          showIcon
          style={{ width: '100%' }}
          key="failedReason"
          type="error"
          message={<Typography type="danger">RPC Service validation failure</Typography>}
          description={
            <Typography>
              The following errors were detected during validation:
              <ul style={{ paddingLeft: 16 }}>
                {failedEndpoints.map((i) => (
                  <li key={i.key}>{i.reason}</li>
                ))}
              </ul>
            </Typography>
          }
        />
      );
    }

    return render;
  }, [project.serviceEndpoints]);

  if (!metadata || !keys.data) return <Skeleton paragraph={{ rows: 5 }} active />;
  return (
    <CardContainer style={{ flexDirection: 'column' }}>
      <div style={{ display: 'flex' }}>
        <Typography variant="h6" weight={500}>
          RPC Service
        </Typography>
        <span style={{ flex: 1 }} />
        {rpcButtons}
      </div>

      <div
        style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}
      >
        {renderServicesEndpoints}

        {project.projectConfig.serviceEndpoints.length ? (
          <div style={{ width: 1, height: 20, background: 'var(--sq-gray400)' }} />
        ) : (
          ''
        )}

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Typography type="secondary">Rate Limits</Typography>
          </div>
          <Typography style={{ marginTop: 8 }} variant="medium">
            {project.rateLimit || '∞'} rps
          </Typography>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {renderServicesEndpointsFailed}
      </div>
      <Drawer
        open={showRpcDrawer}
        rootClassName="popupViewDrawer"
        width="30%"
        onClose={() => {
          setShowRpcDrawer(false);
        }}
        title={<Typography> Update Project Setting </Typography>}
        footer={null}
      >
        <RpcSetting
          onCancel={() => {
            setShowRpcDrawer(false);
          }}
          onSubmit={() => {
            refresh();
            setShowRpcDrawer(false);
          }}
        />
      </Drawer>
    </CardContainer>
  );
};

export default ProjectRpcServiceCard;
