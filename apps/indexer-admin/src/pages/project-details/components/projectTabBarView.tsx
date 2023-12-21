// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useCallback, useState } from 'react';
import { BsBookmarkDash } from 'react-icons/bs';
import { AppstoreOutlined, LineChartOutlined } from '@ant-design/icons';
import { SubqlTabs } from '@subql/components';

import { ProjectPAYG } from '../payg/projectPayg';
import { ProjectDetails, ProjectServiceMetadata } from '../types';
import ProjectDetailsView from './projectDetailsView';
import ProjectInsights from './projectInsights';

enum TabbarItem {
  ProjectDetails = 'projectDetail',
  PAYG = 'payg',
  ProjectInsights = 'insight',
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
        <AppstoreOutlined style={{ transform: 'rotate(45deg) translateX(2px)', fontSize: 16 }} />
        Project Details
      </>
    ),
  },
  {
    key: TabbarItem.PAYG,
    label: (
      <>
        <BsBookmarkDash style={{ marginRight: 12 }} />
        Flex Plan
      </>
    ),
  },
  {
    key: TabbarItem.ProjectInsights,
    label: (
      <>
        <LineChartOutlined />
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
      case TabbarItem.PAYG:
        return <ProjectPAYG id={id} config={config} />;
      case TabbarItem.ProjectInsights:
        return <ProjectInsights id={id} />;
      default:
        return <div />;
    }
  }, [config, id, project, value]);

  return (
    <div style={{ marginTop: 30 }}>
      <SubqlTabs items={tabItems} onChange={(activeKey) => handleChange(activeKey as TabbarItem)} />
      {renderContent()}
    </div>
  );
};

export default ProjectTabbarView;
