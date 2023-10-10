// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { indexingProgress } from '@subql/network-clients';
import { renderAsync } from '@subql/react-hooks';
import { useInterval } from 'ahooks';
import { FormikHelpers, FormikValues } from 'formik';
import { isUndefined } from 'lodash';

import AlertView from 'components/alertView';
import { LoadingSpinner } from 'components/loading';
import { PopupView } from 'components/popupView';
import { useAccount } from 'containers/account';
import { useNotification } from 'containers/notificationContext';
import {
  getQueryMetadata,
  useIndexingStatus,
  useIsOnline,
  useNodeVersions,
  useProjectDetails,
  useQueryVersions,
} from 'hooks/projectHook';
import { useRouter } from 'hooks/routerHook';
import { useIndexingAction } from 'hooks/transactionHook';
import { ProjectFormKey } from 'types/schemas';
import { parseError } from 'utils/error';
import { ProjectNotification } from 'utils/notification';
import { isTrue } from 'utils/project';
import { REMOVE_PROJECT, START_PROJECT, STOP_PROJECT } from 'utils/queries';

import ProjectDetailsHeader from './components/projectDetailHeader';
import ProjectServiceCard from './components/projectServiceCard';
import ProjectStatusView from './components/projectStatusView';
import ProjectTabbarView from './components/projectTabBarView';
import ProjectUptime from './components/projectUptime';
import {
  alertMessages,
  createAnnounceIndexingSteps,
  createNetworkButtonItems,
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
  IndexingStatus,
  ProjectAction,
  ProjectDetails,
  ProjectStatus,
  TQueryMetadata,
} from './types';

const ProjectDetailsPage = () => {
  const { id } = useParams() as { id: string };
  const { account } = useAccount();
  const {
    state: { data: projectDetails } = { data: undefined },
  }: { state: { data: ProjectDetails | undefined } } = useLocation();
  const status = useIndexingStatus(id);
  const projectQuery = useProjectDetails(id);
  const history = useHistory();
  // a weird but awesome way to solve the hooks cannot be used in judge.
  useRouter(!projectDetails);

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
  const isOnline = useIsOnline({
    deploymentId: id,
    indexer: account || '',
  });

  const fetchQueryMetadata = useCallback(async () => {
    const data = await getQueryMetadata(id);
    setMetadata(data);
  }, [id, setMetadata]);

  useInterval(() => {
    fetchQueryMetadata();
  }, 15000);

  const updateServiceStatus = useCallback(() => {
    const intervalId = setInterval(() => fetchQueryMetadata(), 6000);
    setTimeout(() => {
      clearInterval(intervalId);
      projectQuery.refetch();
    }, 60000);
  }, [fetchQueryMetadata, projectQuery]);

  const loading = useMemo(
    () => startProjectLoading || stopProjectLoading || removeProjectLoading,
    [startProjectLoading, stopProjectLoading, removeProjectLoading]
  );

  const projectStatus = useMemo(() => {
    if (!metadata) return ProjectStatus.Unknown;

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
      case IndexingStatus.NOTINDEXING:
        return healthy ? ProjectStatus.Started : ProjectStatus.NotIndexing;
      case IndexingStatus.INDEXING:
        return healthy ? ProjectStatus.Indexing : ProjectStatus.Unhealthy;
      case IndexingStatus.READY:
        return healthy ? ProjectStatus.Ready : ProjectStatus.Unhealthy;
      default:
        return ProjectStatus.NotIndexing;
    }
  }, [status, metadata]);

  const alertInfo = useMemo(() => {
    if (projectStatus === ProjectStatus.Terminated || projectStatus === ProjectStatus.Unhealthy) {
      if (status !== IndexingStatus.NOTINDEXING) {
        return { ...alertMessages[projectStatus] };
      }
    }
    return undefined;
  }, [projectStatus, status]);

  const networkBtnItems = createNetworkButtonItems((type: ProjectAction) => {
    setActionType(type);
    setVisible(true);
  });

  const serviceBtnItems = createServiceButtonItems((type: ProjectAction) => {
    setActionType(type);
    setVisible(true);
  });

  const networkActionItems = useMemo(() => {
    if (isUndefined(projectStatus) || projectStatus === ProjectStatus.Unknown) return [];
    if (projectStatus === ProjectStatus.Terminated || projectStatus === ProjectStatus.Unhealthy) {
      if (status === IndexingStatus.NOTINDEXING) {
        return [];
      }
    }
    return networkBtnItems[projectStatus];
  }, [networkBtnItems, projectStatus, status]);

  const serviceActionItems = useMemo(() => {
    if (isUndefined(projectStatus) || projectStatus === ProjectStatus.Unknown) return [];
    return serviceBtnItems[projectStatus];
  }, [projectStatus, serviceBtnItems]);

  const onPopoverClose = useCallback((error?: any) => {
    if (error) {
      parseError(error, {
        alert: true,
      });
      return;
    }

    setVisible(false);
  }, []);

  const imageVersions = useMemo(
    () => ({ query: queryVersions, node: nodeVersions }),
    [nodeVersions, queryVersions]
  );

  const projectStateChange = useCallback(
    (type: ProjectNotification.Started | ProjectNotification.Terminated) => {
      const notification = notifications[type];
      dispatchNotification(notification);
      updateServiceStatus();
    },
    [dispatchNotification, updateServiceStatus]
  );

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
      await stopProjectRequest({ variables: { id } });
      onPopoverClose();
      projectStateChange(ProjectNotification.Terminated);
    } catch (e) {
      console.error('fail to stop project', e);
    }
  }, [stopProjectRequest, onPopoverClose, projectStateChange, id]);

  const removeProject = useCallback(async () => {
    try {
      await removeProjectRequest({ variables: { id } });
      history.replace('/projects');
    } catch (e) {
      console.error('fail to remove project', e);
    }
  }, [removeProjectRequest, history, id]);

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
    const announceIndexingSteps = createAnnounceIndexingSteps(() =>
      indexingAction(ProjectAction.AnnounceIndexing, onPopoverClose)
    );
    const announceReadySteps = createReadyIndexingSteps(() =>
      indexingAction(ProjectAction.AnnounceReady, onPopoverClose)
    );
    const announceNotIndexingSteps = createNotIndexingSteps(() =>
      indexingAction(ProjectAction.AnnounceNotIndexing, onPopoverClose)
    );

    return {
      ...startIndexingSteps,
      ...restartProjectSteps,
      ...stopIndexingSteps,
      ...stopProjectSteps,
      ...removeProjectSteps,
      ...announceIndexingSteps,
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
  ]);

  useEffect(() => {
    metadata &&
      setProgress(
        indexingProgress({
          startHeight: metadata.startHeight ?? 0,
          targetHeight: metadata.targetHeight,
          currentHeight: metadata.lastProcessedHeight,
        })
      );
  }, [metadata]);

  useEffect(() => {
    fetchQueryMetadata();
  }, [fetchQueryMetadata, status]);

  const [modalTitle, modalSteps] = useMemo(() => {
    if (!actionType) return ['', []];
    if (!steps) return ['', []];
    return [ProjectActionName[actionType], steps[actionType]];
  }, [actionType, steps]);

  return renderAsync(projectQuery, {
    loading: () => <LoadingSpinner />,
    error: () => <>Unable to get Project Info</>,
    data: ({ project }) => (
      <Container>
        <ContentContainer>
          <ProjectDetailsHeader
            id={id}
            projectStatus={projectStatus}
            project={project}
            onlineStatus={isOnline}
          />
          <ProjectStatusView
            percent={progress}
            actionItems={networkActionItems}
            status={status}
            metadata={metadata}
          />
          <ProjectServiceCard id={id} actionItems={serviceActionItems} data={metadata} />
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
    ),
  });
};

export default ProjectDetailsPage;
