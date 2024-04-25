// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { indexingProgress } from '@subql/network-clients';
import { renderAsync } from '@subql/react-hooks';
import { useInterval } from 'ahooks';
import { FormikHelpers, FormikValues } from 'formik';
import { isUndefined } from 'lodash';

import AlertView from 'components/alertView';
import { LoadingSpinner } from 'components/loading';
import { PopupView } from 'components/popupView';
import { useNotification } from 'containers/notificationContext';
import {
  getQueryMetadata,
  useDeploymentStatus,
  useNodeVersions,
  useProjectDetails,
  useQueryVersions,
} from 'hooks/projectHook';
import { useIndexingAction } from 'hooks/transactionHook';
import { ProjectFormKey } from 'types/schemas';
import { parseError } from 'utils/error';
import { ProjectNotification } from 'utils/notification';
import { isTrue } from 'utils/project';
import { REMOVE_PROJECT, START_PROJECT, STOP_PROJECT } from 'utils/queries';

import ProjectDetailsHeader from './components/projectDetailHeader';
import ProjectRpcServiceCard from './components/projectRpcServiceCard';
import ProjectServiceCard from './components/projectServiceCard';
import ProjectStatusView from './components/projectStatusView';
import ProjectTabbarView from './components/projectTabBarView';
import ProjectUptime from './components/projectUptime';
import {
  alertMessages,
  createNotIndexingSteps,
  createReadyIndexingSteps,
  createRemoveProjectSteps,
  createRestartProjectSteps,
  createServiceButtonItems,
  createStartIndexingSteps,
  createStopIndexingSteps,
  createStopProjectSteps,
  notifications,
  ProjectActionName,
} from './config';
import { Container, ContentContainer } from './styles';
import {
  dockerContainerEnum,
  ProjectAction,
  ProjectStatus,
  ProjectType,
  ServiceStatus,
  TQueryMetadata,
} from './types';

const ProjectDetailsPage = () => {
  const { id } = useParams() as { id: string };
  const { status, getDeploymentStatus } = useDeploymentStatus(id);
  const projectQuery = useProjectDetails(id);
  const history = useHistory();

  const indexingAction = useIndexingAction(id);
  const { dispatchNotification } = useNotification();
  const [startProjectRequest, { loading: startProjectLoading }] = useMutation(START_PROJECT);
  const [stopProjectRequest, { loading: stopProjectLoading }] = useMutation(STOP_PROJECT);
  const [removeProjectRequest, { loading: removeProjectLoading }] = useMutation(REMOVE_PROJECT);
  const queryVersions = useQueryVersions(id);
  const nodeVersions = useNodeVersions(id);

  const [progress, setProgress] = useState(0);
  const [metadata, setMetadata] = useState<TQueryMetadata>();
  const [visible, setVisible] = useState(false);
  const [actionType, setActionType] = useState<ProjectAction>();

  const fetchQueryMetadata = useCallback(async () => {
    if (!projectQuery.data) return;
    const data = await getQueryMetadata(id, projectQuery.data.project.projectType);
    setMetadata(data);
  }, [id, setMetadata, projectQuery]);

  const updateServiceStatus = useCallback(() => {
    const intervalId = setInterval(() => fetchQueryMetadata(), 6000);
    setTimeout(() => {
      clearInterval(intervalId);
      projectQuery.refetch();
    }, 60000);
  }, [fetchQueryMetadata, projectQuery]);

  const projectStateChange = useCallback(
    (type: ProjectNotification.Started | ProjectNotification.Terminated) => {
      const notification = notifications[type];
      dispatchNotification(notification);
      updateServiceStatus();
    },
    [dispatchNotification, updateServiceStatus]
  );

  const onPopoverClose = useCallback((error?: any) => {
    if (error) {
      parseError(error, {
        alert: true,
      });
      return;
    }

    setVisible(false);
  }, []);

  const startProject = useCallback(
    async (values: FormikValues, formHelper: FormikHelpers<FormikValues>) => {
      try {
        const { purgeDB } = values;
        await startProjectRequest({
          variables: {
            ...values,
            purgeDB: isTrue(purgeDB),
            id,
          },
        });

        onPopoverClose();
        projectStateChange(ProjectNotification.Started);
      } catch (e) {
        formHelper.setErrors({ [ProjectFormKey.networkEndpoints]: 'Invalid service endpoint' });
      }
    },
    [startProjectRequest, onPopoverClose, projectStateChange, id]
  );

  const stopProject = useCallback(async () => {
    try {
      await stopProjectRequest({
        variables: { id, projectType: projectQuery.data?.project.projectType },
      });
      onPopoverClose();
      projectStateChange(ProjectNotification.Terminated);
    } catch (e) {
      console.error('fail to stop project', e);
    }
  }, [stopProjectRequest, onPopoverClose, projectStateChange, id, projectQuery.data]);

  const removeProject = useCallback(async () => {
    try {
      await removeProjectRequest({
        variables: { id, projectType: projectQuery.data?.project.projectType },
      });
      history.replace('/projects');
    } catch (e) {
      console.error('fail to remove project', e);
    }
  }, [removeProjectRequest, history, id, projectQuery.data]);

  const serviceBtnItems = useMemo(
    () =>
      createServiceButtonItems((type: ProjectAction) => {
        setActionType(type);
        setVisible(true);
      }),
    []
  );

  const loading = useMemo(
    () => startProjectLoading || stopProjectLoading || removeProjectLoading,
    [startProjectLoading, stopProjectLoading, removeProjectLoading]
  );

  const projectDetails = useMemo(() => {
    return projectQuery.data?.project;
  }, [projectQuery]);

  const projectStatus = useMemo(() => {
    if (!metadata) return ProjectStatus.Unknown;

    if (projectQuery.data?.project.projectConfig?.serviceEndpoints?.length) {
      if (projectQuery.data?.project.projectConfig.serviceEndpoints.every((i) => i.valid)) {
        return ProjectStatus.Ready;
      }

      return ProjectStatus.Unhealthy;
    }

    if (
      metadata.indexerStatus === dockerContainerEnum.TERMINATED &&
      metadata.queryStatus === dockerContainerEnum.TERMINATED
    ) {
      return ProjectStatus.Terminated;
    }

    if (
      metadata.indexerStatus === dockerContainerEnum.STARTING ||
      metadata.queryStatus === dockerContainerEnum.STARTING
    ) {
      return ProjectStatus.Starting;
    }

    const healthy = metadata?.indexerStatus === dockerContainerEnum.HEALTHY;
    switch (status) {
      case ServiceStatus.TERMINATED:
        return healthy ? ProjectStatus.Started : ProjectStatus.NotIndexing;
      case ServiceStatus.READY:
        return healthy ? ProjectStatus.Ready : ProjectStatus.Unhealthy;
      default:
        return ProjectStatus.NotIndexing;
    }
  }, [status, metadata, projectQuery]);

  const alertInfo = useMemo(() => {
    if (projectStatus === ProjectStatus.Terminated || projectStatus === ProjectStatus.Unhealthy) {
      if (status !== ServiceStatus.TERMINATED) {
        return { ...alertMessages[projectStatus] };
      }
    }
    return undefined;
  }, [projectStatus, status]);

  const serviceActionItems = useMemo(() => {
    if (isUndefined(projectStatus) || projectStatus === ProjectStatus.Unknown) return [];
    return serviceBtnItems[projectStatus];
  }, [projectStatus, serviceBtnItems]);

  const imageVersions = useMemo(
    () => ({ query: queryVersions, node: nodeVersions }),
    [nodeVersions, queryVersions]
  );

  const steps = useMemo(() => {
    if (!projectDetails) return false;
    const startIndexingSteps = createStartIndexingSteps(
      projectDetails,
      imageVersions,
      startProject
    );
    const restartProjectSteps = createRestartProjectSteps(
      projectDetails,
      imageVersions,
      startProject
    );
    const stopIndexingSteps = createStopIndexingSteps(stopProject);

    const stopProjectSteps = createStopProjectSteps(stopProject);
    const removeProjectSteps = createRemoveProjectSteps(removeProject);
    const announceReadySteps = createReadyIndexingSteps(() =>
      indexingAction(ProjectAction.AnnounceReady, onPopoverClose, () => {
        getDeploymentStatus();
      })
    );
    const announceNotIndexingSteps = createNotIndexingSteps(() =>
      indexingAction(ProjectAction.AnnounceTerminating, onPopoverClose, () => {
        getDeploymentStatus();
      })
    );

    return {
      ...startIndexingSteps,
      ...restartProjectSteps,
      ...stopIndexingSteps,
      ...stopProjectSteps,
      ...removeProjectSteps,
      ...announceReadySteps,
      ...announceNotIndexingSteps,
    };
  }, [
    projectDetails,
    imageVersions,
    startProject,
    stopProject,
    removeProject,
    indexingAction,
    onPopoverClose,
    getDeploymentStatus,
  ]);

  const [modalTitle, modalSteps] = useMemo(() => {
    if (!actionType) return ['', []];
    if (!steps) return ['', []];
    return [ProjectActionName[actionType], steps[actionType]];
  }, [actionType, steps]);

  useEffect(() => {
    metadata &&
      setProgress(
        indexingProgress({
          startHeight: metadata.startHeight ?? 0,
          targetHeight: metadata.targetHeight,
          currentHeight: metadata.lastHeight,
        })
      );
  }, [metadata]);

  useEffect(() => {
    fetchQueryMetadata();
  }, [fetchQueryMetadata, status]);

  useInterval(() => {
    fetchQueryMetadata();
  }, 15000);

  return renderAsync(projectQuery, {
    loading: () => <LoadingSpinner />,
    error: () => <>Unable to get Project Info</>,
    data: ({ project }) => {
      return (
        <Container>
          <ContentContainer>
            <ProjectDetailsHeader
              id={id}
              project={project}
              status={status}
              onRemoveProject={() => {
                setActionType(ProjectAction.RemoveProject);
                setVisible(true);
              }}
              announceReady={() => {
                setActionType(ProjectAction.AnnounceReady);
                setVisible(true);
              }}
              announceStop={() => {
                setActionType(ProjectAction.AnnounceTerminating);
                setVisible(true);
              }}
            />
            {project.projectType === ProjectType.SubQuery && (
              <ProjectServiceCard
                id={id}
                project={project}
                actionItems={serviceActionItems}
                data={metadata}
                projectStatus={projectStatus}
                update={() => {
                  setActionType(ProjectAction.RestartProject);
                  setVisible(true);
                }}
                stop={() => {
                  setActionType(ProjectAction.StopProject);
                  setVisible(true);
                }}
              />
            )}
            {project.projectType === ProjectType.Rpc && (
              <ProjectRpcServiceCard
                project={project}
                metadata={metadata}
                projectStatus={projectStatus}
                refresh={() => {
                  projectQuery.refetch();
                }}
              />
            )}
            <ProjectStatusView percent={progress} metadata={metadata} />
            <ProjectUptime />
            {projectDetails && (
              <ProjectTabbarView id={id} project={project} config={projectDetails} />
            )}
          </ContentContainer>
          <PopupView
            setVisible={setVisible}
            visible={visible}
            title={modalTitle}
            onClose={() => onPopoverClose()}
            // @ts-ignore
            steps={modalSteps}
            type={actionType}
            loading={loading}
          />
          {alertInfo && <AlertView {...alertInfo} />}
        </Container>
      );
    },
  });
};

export default ProjectDetailsPage;
