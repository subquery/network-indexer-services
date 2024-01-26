// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { WarningOutlined } from '@ant-design/icons';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client';
import { openNotification, Steps, Typography } from '@subql/components';
import { renderAsync } from '@subql/react-hooks';
import { Button, Collapse, Drawer, Form, Input } from 'antd';
import { useForm } from 'antd/es/form/Form';
import debounce from 'debounce-promise';
import { isEmpty } from 'lodash';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { IndexingForm } from 'components/forms/restartIndexing';
import { LoadingSpinner } from 'components/loading';
import { Text } from 'components/primary';
import { useIsIndexer } from 'hooks/indexerHook';
import { useGetIfUnsafeDeployment } from 'hooks/useGetIfUnsafeDeployment';
import RpcSetting from 'pages/project-details/components/rpcSetting';
import { ProjectDetails, ProjectType, TQueryMetadata } from 'pages/project-details/types';
import { ProjectFormKey } from 'types/schemas';
import { parseError } from 'utils/error';
import {
  ADD_PROJECT,
  GET_MANIFEST,
  GET_PROJECT_NAME,
  GET_PROJECTS,
  GET_PROJECTS_METADATA,
  ManiFest,
} from 'utils/queries';

import ProjecItemsHeader from './components/projecItemsHeader';
import ProjectItem from './components/projectItem';
import EmptyView from './components/projectsEmptyView';
import { Container, ContentContainer, HeaderContainer } from './styles';

const Projects = () => {
  const projectsQuery = useQuery(GET_PROJECTS, {
    defaultOptions: { fetchPolicy: 'network-only' },
    fetchPolicy: 'network-only',
  });
  const projectsMetadata = useQuery<{
    getProjectsMetadata: {
      id: string;
      metadata: TQueryMetadata;
    }[];
  }>(GET_PROJECTS_METADATA, {
    defaultOptions: { fetchPolicy: 'network-only' },
    fetchPolicy: 'network-only',
  });

  const { getIfUnsafe, isUnsafe } = useGetIfUnsafeDeployment();
  const [addProject] = useMutation(ADD_PROJECT);
  const [validateManifest, manifest] = useLazyQuery<ManiFest>(GET_MANIFEST);
  const [getProjectName, projectName] = useLazyQuery<{ getProjectInfo: { name: string } }>(
    GET_PROJECT_NAME
  );
  const isIndexer = useIsIndexer();

  const [form] = useForm();
  const processingId = Form.useWatch('deploymentId', { form, preserve: true });
  const [visible, setVisible] = useState(false);
  const [addProjectLoading, setAddProjectLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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
                metadataLoading={projectsMetadata.loading}
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

  const processingProject = useMemo(() => {
    return projectsQuery.data?.getProjects?.find((i: { id: string }) => i.id === processingId);
  }, [processingId, projectsQuery.data]);

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

  const debouncedValidator = useMemo(() => {
    return debounce(async (_: any, value: string) => {
      await getProjectName({
        variables: {
          id: value,
        },
      });
      const res = await validateManifest({
        variables: {
          projectId: value,
        },
      });

      if (!res.data?.getManifest.rpcManifest && !res.data?.getManifest.subqueryManifest) {
        return Promise.reject(new Error("Can't found the manifest information"));
      }

      await getIfUnsafe(value);

      return Promise.resolve();
    }, 1000);
  }, [validateManifest, getProjectName, getIfUnsafe]);

  return renderAsync(projectsQuery, {
    loading: () => <LoadingSpinner />,
    error: (error) => (
      <EmptyView
        onClick={() => {
          openNotification({
            type: 'error',
            description: `There are errors, please refetch the page or upgrade to latest version. ${error.message}`,
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
                  <Form.Item
                    label="Deployment ID"
                    name="deploymentId"
                    hasFeedback
                    rules={[
                      { required: true },
                      () => {
                        return {
                          validator: debouncedValidator,
                        };
                      },
                    ]}
                  >
                    <Input />
                  </Form.Item>
                  {manifest.data && (
                    <Form.Item label="Project Details">
                      <SubqlCollapse>
                        <Collapse
                          items={[
                            {
                              key: 'detail',
                              label: (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <Avatar address={'0x000' || processingId} size={50} />

                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <Typography>{projectName.data?.getProjectInfo.name}</Typography>
                                    <Typography variant="small" type="secondary">
                                      {manifest.data?.getManifest.rpcManifest
                                        ? 'RPC Endpoint'
                                        : 'Data Indexer'}
                                    </Typography>
                                  </div>
                                </div>
                              ),
                              children: (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Typography type="secondary" variant="medium">
                                      Chain ID:
                                    </Typography>
                                    <Typography
                                      variant="medium"
                                      style={{ overflowWrap: 'anywhere' }}
                                    >
                                      {manifest.data?.getManifest.rpcManifest?.chain.chainId ||
                                        manifest.data.getManifest.subqueryManifest?.network
                                          ?.chainId ||
                                        'Unknown'}
                                    </Typography>
                                  </div>
                                  {manifest.data?.getManifest.rpcManifest && (
                                    <>
                                      <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                      >
                                        <Typography type="secondary" variant="medium">
                                          Family:
                                        </Typography>
                                        <Typography variant="medium">
                                          {manifest.data?.getManifest.rpcManifest?.rpcFamily.join(
                                            ' '
                                          )}
                                        </Typography>
                                      </div>
                                      <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                      >
                                        <Typography type="secondary" variant="medium">
                                          Client:
                                        </Typography>
                                        <Typography variant="medium">
                                          {manifest.data?.getManifest.rpcManifest?.client?.name ||
                                            'Unknown'}
                                        </Typography>
                                      </div>
                                      <div
                                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                                      >
                                        <Typography type="secondary" variant="medium">
                                          Node type:
                                        </Typography>
                                        <Typography variant="medium">
                                          {manifest.data?.getManifest.rpcManifest?.nodeType}
                                        </Typography>
                                      </div>
                                    </>
                                  )}
                                </div>
                              ),
                            },
                          ]}
                        />
                      </SubqlCollapse>
                    </Form.Item>
                  )}

                  {isUnsafe && (
                    <WarnStyle>
                      <WarningOutlined
                        style={{ color: 'var(--sq-warning)', fontSize: 18, marginTop: 2 }}
                      />
                      <div>
                        <Typography variant="medium">
                          This project is not completely safe
                        </Typography>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                          <Typography variant="medium" type="secondary">
                            SubQuery can’t guarantee that this project is deterministic, which means
                            it is not entirely safe.
                          </Typography>
                          <Typography variant="medium" type="secondary">
                            This means that two indexers are not guaranteed to index exactly the
                            same data when indexing this project. In most cases, Indexers will still
                            run this project, however they might be reluctant to do so.
                          </Typography>
                          <Typography variant="medium" type="secondary">
                            By proceeding, you acknowledge the potential risks associated with
                            deploying an &apos;unsafe&apos; project. Learn more about unsafe
                            project.
                          </Typography>
                        </div>
                      </div>
                    </WarnStyle>
                  )}
                </Form>
              </div>
              <div style={{ flex: 1 }} />
              <div style={{ textAlign: 'right' }}>
                <Button
                  shape="round"
                  type="primary"
                  loading={addProjectLoading || manifest.loading || projectName.loading}
                  onClick={async () => {
                    await form.validateFields();
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
          {currentStep === 1 && processingProject.projectType === ProjectType.SubQuery && (
            <IndexingForm
              id={processingId}
              setVisible={(val) => {
                setVisible(val);
              }}
            />
          )}
          {currentStep === 1 && processingProject.projectType === ProjectType.Rpc && (
            <RpcSetting
              id={processingId}
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

const WarnStyle = styled.div`
  display: flex;
  align-items: flex-start;
  padding: 9px 16px;
  border-radius: 8px;
  border: 1px solid rgba(248, 124, 79, 0.5);
  background: rgba(248, 124, 79, 0.08);
  gap: 6px;
`;

export default Projects;
