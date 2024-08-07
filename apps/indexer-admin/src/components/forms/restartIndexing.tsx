// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Dispatch, FC, SetStateAction, useEffect, useMemo, useState } from 'react';
import { NOTIFICATION_TYPE } from 'react-notifications-component';
import { useParams } from 'react-router-dom';
import {
  InfoCircleOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  SketchOutlined,
} from '@ant-design/icons';
import { useMutation } from '@apollo/client';
import { Typography } from '@subql/components';
import { renderAsync } from '@subql/react-hooks';
import {
  Button,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Radio,
  Row,
  Select,
  Slider,
  Switch,
  Tooltip,
} from 'antd';
import { useWatch } from 'antd/es/form/Form';
import Link from 'antd/es/typography/Link';
import { cloneDeep } from 'lodash';
import styled from 'styled-components';

import { LoadingSpinner } from 'components/loading';
import { ButtonContainer } from 'components/primary';
import { useNotification } from 'containers/notificationContext';
import { useNodeVersions, useProjectDetails, useQueryVersions } from 'hooks/projectHook';
import { HorizeFormItem } from 'pages/project-details/components/rpcSetting';
import { defaultAdvancedConfig, ProjectFormKey, StartIndexingSchema } from 'types/schemas';
import { START_PROJECT } from 'utils/queries';

const { poiEnabled, timeout } = defaultAdvancedConfig;
const { Item } = Form;

const advancedOptionsConfig = [
  {
    name: ProjectFormKey.batchSize,
    label: 'Batch Size',
    tooltip: 'Batch size of blocks to fetch in one round',
    min: 1,
    max: 100,
  },
  {
    name: ProjectFormKey.worker,
    label: 'Workers',
    tooltip: 'Number of worker threads to use for fetching and processing blocks.',
    min: 1,
    max: 8,
  },
  {
    name: ProjectFormKey.cache,
    label: 'Cache Number',
    tooltip: 'The number of items to cache in memory for faster processing.',
    min: 1,
    max: 500,
  },
  {
    name: ProjectFormKey.cpu,
    label: 'Number of Cpus',
    tooltip: 'The number of CPUs that can be used by the subquery indexer for this project.',
    min: 1,
    max: 8,
  },
  {
    name: ProjectFormKey.memory,
    label: 'Memory',
    tooltip: 'The amount of memory that can be used by the subquery indexer for this project.',
    min: 1,
    max: 8192,
  },
];

const getYupRule = (field: string) => ({
  validator(_: any, value: any) {
    try {
      console.warn(field, { [field]: value });
      StartIndexingSchema.validateSyncAt(field, { [field]: value });
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },
});

function displayVersion(versions: string[]) {
  return versions.map((version, i) => (
    <Select.Option key={i} value={version}>
      {version}
    </Select.Option>
  ));
}

const defaultTooltipProps = (title: React.ReactNode) => ({
  title: <Typography variant="medium">{title}</Typography>,
  color: 'white',
  children: (
    <InfoCircleOutlined style={{ fontSize: 14, color: 'var(--sq-gray500)', marginLeft: 6 }} />
  ),
  icon: <InfoCircleOutlined style={{ fontSize: 14, color: 'var(--sq-gray500)', marginLeft: 6 }} />,
});

const NetworkEndpointsTooltip = () => (
  <Tooltip
    {...defaultTooltipProps(
      <Typography variant="medium" color="var(--gray-900)" style={{ width: 368 }}>
        We recommend offering multiple endpoints for the following advantages: <br />
        <StrongInter>Increased speed</StrongInter> - When enabled with worker threads, RPC calls are
        distributed and parallelised among RPC providers. Historically, RPC latency is often the
        limiting factor with SubQuery.
        <br />
        <StrongInter>Increased reliability</StrongInter> - If an endpoint goes offline, SubQuery
        will automatically switch to other RPC providers to continue indexing without interruption.
        <br />
        <StrongInter>Reduced load on RPC providers</StrongInter> - Indexing is a computationally
        expensive process on RPC providers, by distributing requests among RPC providers you are
        lowering the chance that your project will be rate limited.
      </Typography>
    )}
    overlayInnerStyle={{ padding: 16, width: 400 }}
  />
);

type Props = {
  setVisible?: Dispatch<SetStateAction<boolean>>;
  id?: string;
  onSuccess?: () => void;
};

export const IndexingForm: FC<Props> = ({ setVisible, id: propsId, onSuccess }) => {
  const [form] = Form.useForm();
  const [showInput, setShowInput] = useState(false);
  const { dispatchNotification } = useNotification();
  const { id } = useParams() as { id: string };

  const mineId = useMemo(() => propsId || id, [propsId, id]);

  const projectQuery = useProjectDetails(mineId);

  const nodeVersions = useNodeVersions(mineId);
  const queryVersions = useQueryVersions(mineId);
  const [startProjectRequest] = useMutation(START_PROJECT);

  const hostType = useMemo(() => {
    return projectQuery.data?.project.hostType;
  }, [projectQuery.data?.project.hostType]);

  const editHostType = useWatch('hostType', form);

  const onSwitchChange = () => {
    setShowInput(!showInput);
    form.setFieldValue(ProjectFormKey.networkDictionary, '');
  };

  const handleSubmit = (setVisible?: Dispatch<SetStateAction<boolean>>) => async (values: any) => {
    setVisible?.(false);
    dispatchNotification({
      type: 'default' as NOTIFICATION_TYPE,
      title: 'Indexing Request',
      message: 'Request to start the Indexing Project has been dispatched.',
    });

    if (values.purgeDB) {
      dispatchNotification({
        type: 'default' as NOTIFICATION_TYPE,
        title: 'Purge POI',
        message:
          'Sent request to purge Proof of Index (POI), it will take around 2 minutes dependeing on your indexing progress. Monitor the network tab for progress.',
      });
    }

    const projectServiceEndpoint =
      values.hostType === 'user-managed'
        ? [
            {
              key: 'nodeEndpoint',
              value: values.nodeEndpoint,
            },
            {
              key: 'queryEndpoint',
              value: values.queryEndpoint,
            },
          ]
        : [];

    try {
      await startProjectRequest({
        variables: {
          queryVersion: '',
          nodeVersion: '',
          networkEndpoints: [],
          batchSize: 0,
          cache: 0,
          cpu: 0,
          memory: 0,
          ...values,
          poiEnabled,
          timeout,
          workers: values.worker || 0,
          networkDictionary: values.networkDictionary ?? '',
          id: mineId,
          projectType: projectQuery.data?.project.projectType,
          serviceEndpoints: projectServiceEndpoint,
        },
      });
      await projectQuery.refetch();
      await onSuccess?.();

      dispatchNotification({
        type: 'success' as NOTIFICATION_TYPE,
        title: 'Project Initiated',
        message: 'Your Subquery project has been started. Monitor your service logs for any issues',
      });
    } catch (error: any) {
      dispatchNotification({
        type: 'danger' as NOTIFICATION_TYPE,
        title: 'Indexing Initiation Failed',
        message: `An error occurred while requesting the Indexing of the project: ${error.message}`,
      });
    }
  };

  useEffect(() => {
    if (projectQuery.data) {
      const { project } = projectQuery.data;
      if (project?.projectConfig?.networkDictionary) {
        setShowInput(true);
      }
    }
  }, [projectQuery]);

  return renderAsync(projectQuery, {
    loading: () => <LoadingSpinner />,
    error: (e) => {
      console.error(e);
      return <>Unable to get default values</>;
    },
    data: ({ project }) => {
      const { projectConfig } = cloneDeep(project);

      const networkEndpoints =
        projectConfig?.networkEndpoints.length === 0 ? [''] : projectConfig?.networkEndpoints;

      return (
        <StartINdexingForm>
          <Form
            form={form}
            name="form"
            layout="vertical"
            onFinish={handleSubmit(setVisible)}
            initialValues={{
              ...projectConfig,
              networkEndpoints,
              rateLimit: project.rateLimit,
              hostType: hostType === 'un-resolved' ? 'system-managed' : hostType,
              nodeEndpoint: project?.projectConfig?.serviceEndpoints?.find(
                (i) => i.key === 'nodeEndpoint'
              )?.value,
              queryEndpoint: project?.projectConfig?.serviceEndpoints?.find(
                (i) => i.key === 'queryEndpoint'
              )?.value,
            }}
          >
            <Typography variant="medium" style={{ marginBottom: 24 }}>
              <InfoCircleOutlined
                style={{ fontSize: 14, color: 'var(--sq-blue600)', marginRight: 8 }}
              />
              Need help? Visit our docs on{' '}
              <Link
                style={{ color: 'var(--sq-blue600)' }}
                href="https://academy.subquery.network/subquery_network/kepler/indexers/index-project.html#indexing-a-subquery-project"
              >
                Indexing project
              </Link>
            </Typography>
            <Form.Item label="Host type" name="hostType">
              <Radio.Group disabled={hostType !== 'un-resolved'}>
                <Radio value="system-managed">System managed</Radio>
                <Radio value="user-managed">User managed</Radio>
              </Radio.Group>
            </Form.Item>

            {editHostType === 'user-managed' && (
              <>
                <Form.Item
                  label="Node Endpoint"
                  rules={[getYupRule(ProjectFormKey.networkEndpoints)]}
                  style={{ marginBottom: 10, flex: 1 }}
                  name="nodeEndpoint"
                >
                  <Input placeholder="http://192.168.80.131:3000" />
                </Form.Item>

                <Form.Item
                  label="Query Endpoint"
                  rules={[getYupRule(ProjectFormKey.networkEndpoints)]}
                  style={{ marginBottom: 10, flex: 1 }}
                  name="queryEndpoint"
                >
                  <Input placeholder="http://192.168.80.131:3001" />
                </Form.Item>
              </>
            )}

            {editHostType === 'system-managed' && (
              <>
                <Form.List name={ProjectFormKey.networkEndpoints}>
                  {(fields, { add, remove }) => (
                    <>
                      {fields.map((field, index) => (
                        <div
                          style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}
                          key={field.name}
                        >
                          <Form.Item
                            {...field}
                            label={
                              index === 0 ? (
                                <div>
                                  Network Endpoints
                                  <NetworkEndpointsTooltip />
                                </div>
                              ) : (
                                ''
                              )
                            }
                            key={field.key}
                            rules={[getYupRule(ProjectFormKey.networkEndpoints)]}
                            style={{ marginBottom: 0, flex: 1 }}
                          >
                            <Input placeholder="wss://polkadot.api.onfinality.io/public-ws" />
                          </Form.Item>
                          {index === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <div className="ant-col ant-form-item-label">&nbsp;</div>
                              <PlusCircleOutlined
                                style={{ fontSize: 18, color: 'var(--sq-blue600)', marginLeft: 14 }}
                                onClick={() => add()}
                              />
                            </div>
                          ) : (
                            <MinusCircleOutlined
                              style={{ fontSize: 18, color: 'var(--sq-blue600)', marginLeft: 14 }}
                              onClick={() => remove(field.name)}
                            />
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </Form.List>
                <HorizonReverse>
                  <Form.Item label="Override Dictionary" valuePropName="checked">
                    <Switch onChange={onSwitchChange} checked={showInput} />
                  </Form.Item>
                </HorizonReverse>
                {showInput && (
                  <Item
                    label="Dictionary Endpoint"
                    name={ProjectFormKey.networkDictionary}
                    rules={[getYupRule(ProjectFormKey.networkDictionary)]}
                  >
                    <Input placeholder="https://api.subquery.network/sq/subquery/dictionary-polkadot" />
                  </Item>
                )}
              </>
            )}

            <HorizeFormItem>
              <Form.Item
                label="Rate Limit"
                tooltip="This feature allows you to manage and set rate limits for your Flex Plan, helping you optimize service stability and performance"
                name="rateLimit"
              >
                <InputNumber />
              </Form.Item>
              <Typography style={{ marginBottom: 24 }}>Requests/sec</Typography>
            </HorizeFormItem>

            {editHostType === 'system-managed' && (
              <>
                <Row gutter={16}>
                  <Col span={12}>
                    <Item
                      label="Indexer Version"
                      name={ProjectFormKey.nodeVersion}
                      rules={[getYupRule(ProjectFormKey.nodeVersion)]}
                    >
                      <Select>{displayVersion(nodeVersions)}</Select>
                    </Item>
                  </Col>
                  <Col span={12}>
                    <Item
                      label="Query Version"
                      name={ProjectFormKey.queryVersion}
                      rules={[getYupRule(ProjectFormKey.queryVersion)]}
                    >
                      <Select>{displayVersion(queryVersions)}</Select>
                    </Item>
                  </Col>
                </Row>
                <RowReverse>
                  <Collapse defaultActiveKey="1">
                    <Collapse.Panel
                      header={
                        <Typography style={{ display: 'flex', alignItems: 'center' }}>
                          <SketchOutlined
                            style={{ fontSize: 16, color: 'var(--sq-blue600)', marginRight: 8 }}
                          />
                          Advanced Options
                        </Typography>
                      }
                      key="1"
                    >
                      {advancedOptionsConfig.map(({ name, label, tooltip, min, max }, id) => (
                        <Form.Item
                          key={id}
                          name={name}
                          label={label}
                          tooltip={defaultTooltipProps(tooltip)}
                        >
                          <Slider
                            min={min}
                            max={max}
                            marks={{
                              [min]: min,
                              [max]: max,
                            }}
                          />
                        </Form.Item>
                      ))}
                    </Collapse.Panel>
                  </Collapse>
                </RowReverse>
              </>
            )}
            <Form.Item>
              <ButtonContainer align="right" mt={30}>
                <Button type="primary" onClick={() => form.submit()} shape="round" size="large">
                  {/* If re-staring project, there must have network endpoints and must more than 1 length */}
                  {networkEndpoints?.every((i: string) => i.length > 1) ? 'Update' : 'Start'}
                </Button>
              </ButtonContainer>
            </Form.Item>
          </Form>
        </StartINdexingForm>
      );
    },
  });
};

const StrongInter = styled.strong`
  font-family: Inter-Bold;
`;

const StartINdexingForm = styled.div`
  .ant-form-item-label label {
    font-family: var(--sq-font-family);
    font-size: 16px;
    line-height: 24px;
    color: var(--sq-gray900);
  }
`;

const HorizonReverse = styled.div`
  .ant-row.ant-form-item-row {
    flex-direction: row-reverse;
    align-items: center;
  }

  .ant-col.ant-form-item-label {
    flex: 1;
    margin-left: 16px;
    padding: 0;
  }

  .ant-col.ant-form-item-control {
    width: auto;
    flex: none;
  }
`;

const RowReverse = styled.div`
  .ant-collapse-header {
    flex-direction: row-reverse;
  }
`;
