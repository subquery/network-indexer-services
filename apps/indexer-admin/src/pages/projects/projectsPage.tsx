// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { openNotification } from '@subql/components';
import { renderAsync } from '@subql/react-hooks';
import { isEmpty } from 'lodash';

import { LoadingSpinner } from 'components/loading';
import { PopupView } from 'components/popupView';
import { Button, Text } from 'components/primary';
import { useIsIndexer } from 'hooks/indexerHook';
import { ProjectDetails, ProjectsAction } from 'pages/project-details/types';
import { ProjectFormKey } from 'types/schemas';
import { parseError } from 'utils/error';
import { ADD_PROJECT, GET_PROJECTS } from 'utils/queries';

import ProjecItemsHeader from './components/projecItemsHeader';
import ProjectItem from './components/projectItem';
import EmptyView from './components/projectsEmptyView';
import { createAddProjectSteps } from './constant';
import { Container, ContentContainer, HeaderContainer } from './styles';

const Projects = () => {
  const [addProject, { loading: addProjectLoading }] = useMutation(ADD_PROJECT);
  const projectsQuery = useQuery(GET_PROJECTS, { fetchPolicy: 'network-only' });
  const isIndexer = useIsIndexer();

  const [visible, setVisible] = useState(false);
  const onModalClose = () => setVisible(false);

  const step = createAddProjectSteps(async (values, helper) => {
    try {
      // TODO: need to verify the id with subql-common library
      const id = values[ProjectFormKey.deploymentId].trim();
      await addProject({ variables: { id } });
      await projectsQuery.refetch();
      setVisible(false);
    } catch (_) {
      helper.setErrors({ [ProjectFormKey.deploymentId]: 'Invalid deployment id' });
      parseError(_, { alert: true, rawMsg: true });
    }
  });

  const renderProjects = (projectList: ProjectDetails[]) =>
    !isEmpty(projectList) ? (
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
        {projectList.map((props: ProjectDetails) => (
          <ProjectItem key={props.id} {...props} />
        ))}
      </ContentContainer>
    ) : (
      <EmptyView
        onClick={() => {
          setVisible(true);
        }}
      />
    );

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
    data: ({ getProjects: projects }) => (
      <Container>
        {isIndexer && renderProjects(projects)}
        <PopupView
          setVisible={setVisible}
          visible={visible}
          // @ts-ignore
          title={step.addProject[0].title}
          onClose={onModalClose}
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
