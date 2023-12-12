// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useCallback, useState } from 'react';
import { Tabs } from '@subql/components';

import { projectId } from 'utils/project';

import ProjectLogView from '../../../components/logView';
import { ProjectPAYG } from '../payg/projectPayg';
import { ProjectDetails, ProjectServiceMetadata } from '../types';
import ProjectDetailsView from './projectDetailsView';
import ProjectInsights from './projectInsights';
import RateLimit from './rateLimit';

enum TabbarItem {
  ProjectDetails,
  NodeLog,
  PAYG,
  ProjectInsights,
  RateLimit,
}

type Props = {
  id: string;
  project: ProjectDetails;
  config: ProjectServiceMetadata;
  refreshProject: () => void;
};

const tabItems = [
  {
    label: 'Project Details',
  },
  {
    label: 'Service Log',
  },
  {
    label: 'Flex Plan',
  },
  {
    label: 'Project Insights',
  },
  {
    label: 'Rate Limit',
  },
];

const ProjectTabbarView: FC<Props> = ({ id, project, config, refreshProject }) => {
  const [value, setValue] = useState<TabbarItem>(TabbarItem.ProjectDetails);

  const handleChange = (newValue: TabbarItem) => {
    setValue(newValue);
  };

  // SUGGESTION: Use mapping instead of switch case
  const renderContent = useCallback(() => {
    switch (value) {
      case TabbarItem.NodeLog:
        return <ProjectLogView container={`node_${projectId(id)}`} height={650} />;
      case TabbarItem.ProjectDetails:
        return <ProjectDetailsView id={id} project={project} />;
      case TabbarItem.PAYG:
        return <ProjectPAYG id={id} config={config} />;
      case TabbarItem.ProjectInsights:
        return <ProjectInsights id={id} />;
      case TabbarItem.RateLimit:
        return <RateLimit id={id} project={project} refreshProject={refreshProject} />;
      default:
        return <div />;
    }
  }, [config, id, project, value, refreshProject]);

  return (
    <div style={{ marginTop: 30 }}>
      <Tabs tabs={tabItems} onTabClick={handleChange} />
      {renderContent()}
    </div>
  );
};

export default ProjectTabbarView;
