// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { openNotification, Steps, Typography } from '@subql/components';
import { renderAsync } from '@subql/react-hooks';
import { Button, Collapse, Drawer, Form, Input } from 'antd';
import { useForm } from 'antd/es/form/Form';
import { isEmpty } from 'lodash';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { LoadingSpinner } from 'components/loading';
import { Text } from 'components/primary';
import { useIsIndexer } from 'hooks/indexerHook';
import RpcSetting from 'pages/project-details/components/rpcSetting';
import { ProjectDetails, TQueryMetadata } from 'pages/project-details/types';
import { ProjectFormKey } from 'types/schemas';
import { parseError } from 'utils/error';
import { cidToBytes32 } from 'utils/ipfs';
import { ADD_PROJECT, GET_PROJECTS, GET_PROJECTS_METADATA } from 'utils/queries';

import ProjecItemsHeader from './components/projecItemsHeader';
import ProjectItem from './components/projectItem';
import EmptyView from './components/projectsEmptyView';
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
  const [addProject] = useMutation(ADD_PROJECT);
  const isIndexer = useIsIndexer();

  const [visible, setVisible] = useState(false);
  const [addProjectLoading, setAddProjectLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const [form] = useForm();

  const addProjectFunc = async (values: { deploymentId: string }) => {
    try {
      setAddProjectLoading(true);
      const id = values[ProjectFormKey.deploymentId].trim();
      await addProject({ variables: { id } });
      await projectsQuery.refetch();
      await projectsMetadata.refetch();
      setCurrentStep(1);
    } catch (_) {
      parseError(_, { alert: true, rawMsg: true });
    } finally {
      setAddProjectLoading(false);
    }
  };

  const renderProjects = useMemo(() => {
    if (!projectsQuery.data) return null;
    const projectList = projectsQuery.data.getProjects;
    return !isEmpty(projectList) ? (
      <ContentContainer>
        <HeaderContainer>
          <Text size={32}>Projects</Text>
          <Button
            onClick={() => {
              setVisible(true);
              setCurrentStep(0);
              form.resetFields();
            }}
            shape="round"
            size="large"
            type="primary"
          >
            Add Project
          </Button>
        </HeaderContainer>
        <ProjecItemsHeader />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, width: '100%' }}>
          {projectList.map((props: ProjectDetails) => {
            return (
              <ProjectItem
                key={props.id}
                {...props}
                metadata={
                  projectsMetadata.data?.getProjectsMetadata.find((i) => i.id === props.id)
                    ?.metadata
                }
              />
            );
          })}
        </div>
      </ContentContainer>
    ) : (
      <EmptyView
        onClick={() => {
          setVisible(true);
        }}
      />
    );
  }, [projectsQuery, projectsMetadata, form]);

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

        <Drawer
          open={visible}
          rootClassName="popupViewDrawer"
          width="572px"
          onClose={() => {
            setVisible(false);
          }}
          title={<Typography> Add Project </Typography>}
          footer={null}
        >
          {currentStep === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Steps
                  steps={[
                    {
                      title: 'Deployment ID',
                    },
                    {
                      title: 'Deployment Settings',
                    },
                  ]}
                  current={0}
                />
                <Typography>
                  The Deployment ID can be found on project details pages in Explorer
                </Typography>

                <Form layout="vertical" form={form}>
                  <Form.Item label="Deployment ID" name="deploymentId">
                    <Input />
                  </Form.Item>
                  <Form.Item label="Project Details">
                    <SubqlCollapse>
                      <Collapse
                        items={[
                          {
                            key: 'detail',
                            label: (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Avatar address={cidToBytes32('123123')} size={50} />

                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <Typography>XXX</Typography>
                                  <Typography variant="small" type="secondary">
                                    RPC
                                  </Typography>
                                </div>
                              </div>
                            ),
                            children: (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Typography type="secondary" variant="medium">
                                    xxx:
                                  </Typography>
                                  <Typography variant="medium">yyy</Typography>
                                </div>
                              </div>
                            ),
                          },
                        ]}
                      />
                    </SubqlCollapse>
                  </Form.Item>
                </Form>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ textAlign: 'right' }}>
                <Button
                  shape="round"
                  type="primary"
                  loading={addProjectLoading}
                  onClick={async () => {
                    await addProjectFunc({
                      ...form.getFieldsValue(),
                    });
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          {currentStep === 1 && (
            <RpcSetting
              id={form.getFieldValue('deploymentId')}
              onCancel={() => {
                setCurrentStep(0);
              }}
              onSubmit={() => {
                setVisible(false);
              }}
            />
          )}
        </Drawer>
      </Container>
    ),
  });
};

const SubqlCollapse = styled.div`
  .ant-collapse {
    border-color: var(--sq-gray300);
    background: rgba(67, 136, 221, 0.05);
    .ant-collapse-header {
      display: flex;
      flex-direction: row-reverse;
      align-items: center;
    }
    .ant-collapse-item {
      border-bottom-color: var(--sq-gray300);

      .ant-collapse-content {
        border-top: none;
        background-color: transparent;
      }
    }
  }
`;

export default Projects;
