// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useCallback, useMemo, useState } from 'react';
import { BsBookmarkDash } from 'react-icons/bs';
import { PiFileCloudLight } from 'react-icons/pi';
import { AppstoreOutlined, LineChartOutlined } from '@ant-design/icons';
import { SubqlTabs } from '@subql/components';

import { projectId } from 'utils/project';

import ProjectLogView from '../../../components/logView';
import { ProjectPAYG } from '../payg/projectPayg';
import { ProjectDetails, ProjectServiceMetadata, ProjectType } from '../types';
import ProjectDetailsView from './projectDetailsView';
import ProjectInsights from './projectInsights';

enum TabbarItem {
  ProjectDetails = 'projectDetail',
  PAYG = 'payg',
  ProjectInsights = 'insight',
  ServiceLogs = 'serviceLogs',
}

type Props = {
  id: string;
  project: ProjectDetails;
  config: ProjectServiceMetadata;
};

const tabItems = [
  {
    key: TabbarItem.ProjectDetails,
    label: (
      <>
        <AppstoreOutlined
          style={{ transform: 'rotate(45deg) translateX(2px)', fontSize: 16, marginRight: 8 }}
        />
        Project Details
      </>
    ),
  },
  {
    key: TabbarItem.ServiceLogs,
    label: (
      <>
        <PiFileCloudLight style={{ marginRight: 8 }} />
        Service Logs
      </>
    ),
  },
  {
    key: TabbarItem.PAYG,
    label: (
      <>
        <BsBookmarkDash style={{ marginRight: 8 }} />
        Flex Plans
      </>
    ),
  },
  {
    key: TabbarItem.ProjectInsights,
    label: (
      <>
        <LineChartOutlined style={{ marginRight: 8 }} />
        Project Insight
      </>
    ),
  },
];

const ProjectTabbarView: FC<Props> = ({ id, project, config }) => {
  const [value, setValue] = useState<TabbarItem>(TabbarItem.ProjectDetails);

  const handleChange = (newValue: TabbarItem) => {
    setValue(newValue);
  };

  // SUGGESTION: Use mapping instead of switch case
  const renderContent = useCallback(() => {
    switch (value) {
      case TabbarItem.ProjectDetails:
        return <ProjectDetailsView id={id} project={project} />;
      case TabbarItem.ServiceLogs:
        return <ProjectLogView container={`node_${projectId(id)}`} height={650} />;
      case TabbarItem.PAYG:
        return <ProjectPAYG id={id} config={config} />;
      case TabbarItem.ProjectInsights:
        return <ProjectInsights id={id} />;
      default:
        return <div />;
    }
  }, [config, id, project, value]);

  const renderTabs = useMemo(() => {
    if (project.projectType === ProjectType.Rpc || project.projectType === ProjectType.SubGraph) {
      return tabItems.filter((i) => i.key !== TabbarItem.ServiceLogs);
    }
    return tabItems;
  }, [project.projectType]);

  return (
    <div style={{ marginTop: 30 }}>
      <SubqlTabs
        items={renderTabs}
        onChange={(activeKey) => handleChange(activeKey as TabbarItem)}
      />
      {renderContent()}
    </div>
  );
};

export default ProjectTabbarView;
