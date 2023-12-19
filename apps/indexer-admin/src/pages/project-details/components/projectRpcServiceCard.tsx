// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo, useState } from 'react';
import { Typography } from '@subql/components';
import { Button, Drawer, Skeleton } from 'antd';

import { CardContainer } from '../styles';
import { ProjectDetails, ProjectStatus, TQueryMetadata } from '../types';
import RpcSetting from './rpcSetting';

type Props = {
  project: ProjectDetails;
  metadata?: TQueryMetadata;
  projectStatus: ProjectStatus;
};

const ProjectRpcServiceCard: FC<Props> = ({ project, metadata, projectStatus }) => {
  const [showRpcDrawer, setShowRpcDrawer] = useState(false);
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

  if (!metadata) return <Skeleton paragraph={{ rows: 5 }} active />;
  return (
    <CardContainer style={{ flexDirection: 'column' }}>
      <div style={{ display: 'flex' }}>
        <Typography variant="h6" weight={500}>
          RPC Service
        </Typography>
        <span style={{ flex: 1 }} />
        {rpcButtons}
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 40 }}>
        {project.projectConfig.serviceEndpoints.map((endpoint, index) => {
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }} key={endpoint.key || index}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Typography type="secondary">{endpoint.key}</Typography>
              </div>
              <Typography style={{ marginTop: 8 }} variant="medium">
                {endpoint.value}
              </Typography>
            </div>
          );
        })}

        <div style={{ width: 1, height: 20, background: 'var(--sq-gray400)' }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Typography type="secondary">Rate Limits</Typography>
          </div>
          <Typography style={{ marginTop: 8 }} variant="medium">
            {project.rateLimit} rps
          </Typography>
        </div>
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
            setShowRpcDrawer(false);
          }}
        />
      </Drawer>
    </CardContainer>
  );
};

export default ProjectRpcServiceCard;
