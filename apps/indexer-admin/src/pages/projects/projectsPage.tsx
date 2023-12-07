// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { openNotification } from '@subql/components';
import { renderAsync } from '@subql/react-hooks';
import { isEmpty } from 'lodash';

import { LoadingSpinner } from 'components/loading';
import { PopupView } from 'components/popupView';
import { Button, Text } from 'components/primary';
import { useIsIndexer } from 'hooks/indexerHook';
import { ProjectDetails, ProjectsAction, TQueryMetadata } from 'pages/project-details/types';
import { ProjectFormKey } from 'types/schemas';
import { parseError } from 'utils/error';
import { ADD_PROJECT, GET_PROJECTS, GET_PROJECTS_METADATA } from 'utils/queries';

import ProjecItemsHeader from './components/projecItemsHeader';
import ProjectItem from './components/projectItem';
import EmptyView from './components/projectsEmptyView';
import { createAddProjectSteps } from './constant';
import { Container, ContentContainer, HeaderContainer } from './styles';

const Projects = () => {
  const projectsQuery = useQuery(GET_PROJECTS, { fetchPolicy: 'network-only' });
  const projectsMetadata = useQuery<{
    getProjectsMetadata: {
      id: string;
      metadata: TQueryMetadata;
    }[];
  }>(GET_PROJECTS_METADATA, {
    defaultOptions: { fetchPolicy: 'network-only' },
    fetchPolicy: 'network-only',
  });
  const [addProject, { loading: addProjectLoading }] = useMutation(ADD_PROJECT);
  const isIndexer = useIsIndexer();

  const [visible, setVisible] = useState(false);

  const step = createAddProjectSteps(async (values, helper) => {
    try {
      // TODO: need to verify the id with subql-common library
      const id = values[ProjectFormKey.deploymentId].trim();
      await addProject({ variables: { id } });
      await projectsQuery.refetch();
      await projectsMetadata.refetch();
      setVisible(false);
    } catch (_) {
      helper.setErrors({ [ProjectFormKey.deploymentId]: 'Invalid deployment id' });
      parseError(_, { alert: true, rawMsg: true });
    }
  });

  const renderProjects = useMemo(() => {
    if (!projectsQuery.data) return null;
    const projectList = projectsQuery.data.getProjects;
    return !isEmpty(projectList) ? (
      <ContentContainer>
        <HeaderContainer>
          <Text size={45}>Projects</Text>
          <Button
            title="Add Project"
            onClick={() => {
              setVisible(true);
            }}
          />
        </HeaderContainer>
        <ProjecItemsHeader />
        {projectList.map((props: ProjectDetails) => {
          return (
            <ProjectItem
              key={props.id}
              {...props}
              metadata={
                projectsMetadata.data?.getProjectsMetadata.find((i) => i.id === props.id)?.metadata
              }
            />
          );
        })}
      </ContentContainer>
    ) : (
      <EmptyView
        onClick={() => {
          setVisible(true);
        }}
      />
    );
  }, [projectsQuery, projectsMetadata]);

  return renderAsync(projectsQuery, {
    loading: () => <LoadingSpinner />,
    error: (error) => (
      <EmptyView
        onClick={() => {
          openNotification({
            type: 'error',
            description: `There have errors, please contract developer or upgrade to latest version. ${error.message}`,
          });
        }}
      />
    ),
    data: () => (
      <Container>
        {isIndexer && renderProjects}
        <PopupView
          setVisible={setVisible}
          visible={visible}
          // @ts-ignore
          title={step.addProject[0].title}
          onClose={() => setVisible(false)}
          // @ts-ignore
          steps={step.addProject}
          currentStep={0}
          type={ProjectsAction.addProject}
          loading={addProjectLoading}
        />
      </Container>
    ),
  });
};

export default Projects;
