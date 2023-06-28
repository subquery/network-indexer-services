// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Dispatch, FC, SetStateAction, useEffect, useState } from 'react';
import { NOTIFICATION_TYPE } from 'react-notifications-component';
import { useParams } from 'react-router-dom';
import { useMutation } from '@apollo/client';
import { Button } from '@subql/components';
import { renderAsync } from '@subql/react-hooks';
import { Col, Collapse, Form, Input, Row, Select, Slider, Switch } from 'antd';

import { LoadingSpinner } from 'components/loading';
import { ButtonContainer } from 'components/primary';
import { useNotification } from 'containers/notificationContext';
import { useNodeVersions, useProjectDetails, useQueryVersions } from 'hooks/projectHook';
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

type Props = {
  setVisible: Dispatch<SetStateAction<boolean>>;
};

export const IndexingForm: FC<Props> = ({ setVisible }) => {
  const [form] = Form.useForm();
  const [showInput, setShowInput] = useState(true);
  const { dispatchNotification } = useNotification();
  const { id } = useParams() as { id: string };

  const projectQuery = useProjectDetails(id);

  const nodeVersions = useNodeVersions(id);
  const queryVersions = useQueryVersions(id);
  const [startProjectRequest] = useMutation(START_PROJECT);

  const onSwitchChange = () => {
    setShowInput(!showInput);
    form.setFieldValue(ProjectFormKey.networkDictionary, '');
  };

  const handleSubmit = (setVisible: Dispatch<SetStateAction<boolean>>) => async (values: any) => {
    setVisible(false);
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

    try {
      await startProjectRequest({
        variables: {
          ...values,
          poiEnabled,
          timeout,
          workers: values.worker,
          networkDictionary: values.networkDictionary ?? '',
          id,
        },
      });
      form.resetFields();

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
      if (project?.baseConfig?.networkDictionary) {
        setShowInput(false);
      }
    }
  }, [projectQuery]);

  return renderAsync(projectQuery, {
    loading: () => <LoadingSpinner />,
    error: () => <>Unable to get default values</>,
    data: ({ project }) => {
      const { baseConfig, advancedConfig } = project;

      return (
        <Form
          form={form}
          name="form"
          layout="vertical"
          onFinish={handleSubmit(setVisible)}
          initialValues={{ ...baseConfig, ...advancedConfig }}
        >
          <Form.Item
            label="Network Endpoint"
            name={ProjectFormKey.networkEndpoint}
            rules={[getYupRule(ProjectFormKey.networkEndpoint)]}
          >
            <Input placeholder="wss://polkadot.api.onfinality.io/public-ws" />
          </Form.Item>

          <Form.Item label="Is Project Dictionary" valuePropName="checked">
            <Switch onChange={onSwitchChange} defaultChecked checked={showInput} />
          </Form.Item>

          {!showInput && (
            <Item
              label="Dictionary Endpoint"
              name={ProjectFormKey.networkDictionary}
              rules={[getYupRule(ProjectFormKey.networkDictionary)]}
            >
              <Input placeholder="https://api.subquery.network/sq/subquery/dictionary-polkadot" />
            </Item>
          )}
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
          <Form.Item
            name="purgeDB"
            label="Purge POI"
            valuePropName="checked"
            tooltip="Clean the MMR root values on start of indexing."
          >
            <Switch />
          </Form.Item>
          <Collapse defaultActiveKey="1">
            <Collapse.Panel header="Advanced Options" key="1">
              {advancedOptionsConfig.map(({ name, label, tooltip, min, max }, id) => (
                <Form.Item key={id} name={name} label={label} tooltip={tooltip}>
                  <Slider min={min} max={max} />
                </Form.Item>
              ))}
            </Collapse.Panel>
          </Collapse>
          <Form.Item>
            <ButtonContainer align="right" mt={30}>
              <Button label="Submit" type="secondary" onClick={() => form.submit()}>
                Submit
              </Button>
            </ButtonContainer>
          </Form.Item>
        </Form>
      );
    },
  });
};
