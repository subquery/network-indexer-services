// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo, useState } from 'react';
import { useQuery } from '@apollo/client';
import { Typography } from '@subql/components';
import { Button, Drawer } from 'antd';

import { GET_MANIFEST } from 'utils/queries';

import { CardContainer } from '../styles';
import { ProjectDetails, ProjectStatus, TQueryMetadata } from '../types';
import RpcSetting from './rpcSetting';

type Props = {
  project: ProjectDetails;
  metadata?: TQueryMetadata;
  projectStatus: ProjectStatus;
};

const ProjectRpcServiceCard: FC<Props> = ({ project, metadata, projectStatus }) => {
  const manifest = useQuery<{
    getManifest: { rpcManifest: { chain: { chainId: string }; nodeType: string } };
  }>(GET_MANIFEST, {
    variables: {
      projectId: project.id,
      projectType: project.projectType,
    },
  });
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

  if (!metadata) return null;
  return (
    <CardContainer style={{ flexDirection: 'column' }}>
      <div style={{ display: 'flex' }}>
        <Typography variant="h6" weight={500}>
          RPC Service
        </Typography>
        <span style={{ flex: 1 }} />
        {rpcButtons}
      </div>

      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        <div>
          <Typography weight={500}>Node Type</Typography>
          <Typography style={{ marginLeft: 8 }} variant="medium">
            {manifest.data?.getManifest.rpcManifest?.nodeType}
          </Typography>
        </div>
        <div>
          <Typography>Chain ID</Typography>
          <Typography style={{ marginLeft: 8 }} variant="medium">
            {manifest.data?.getManifest.rpcManifest?.chain?.chainId}
          </Typography>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column' }}>
        {project.projectConfig.serviceEndpoints.map((endpoint) => {
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Typography>{endpoint.key}</Typography>
              </div>
              <Typography style={{ marginTop: 8 }} variant="medium">
                {endpoint.value}
              </Typography>
            </div>
          );
        })}
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
