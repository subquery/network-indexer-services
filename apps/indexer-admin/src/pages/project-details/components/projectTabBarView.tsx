// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useCallback, useState } from 'react';
import { Tabs } from '@subql/components';

import { projectId } from 'utils/project';
import { FLEX_PLAN_FEATURE } from 'utils/web3';

import ProjectLogView from '../../../components/logView';
import { ProjectPAYG } from '../payg/projectPayg';
import { ProjectDetails, ProjectServiceMetadata } from '../types';
import ProjectDetailsView from './projectDetailsView';

enum TabbarItem {
  ProjectDetails,
  NodeLog,
  PAYG,
}

type Props = {
  id: string;
  project: ProjectDetails;
  config: ProjectServiceMetadata;
};

const tabItems = [
  {
    label: 'Project Details',
  },
  {
    label: 'Service Log',
  },
];

const flexplanTab = {
  label: 'Flex Plan',
};

const updatedTabItems = FLEX_PLAN_FEATURE ? [...tabItems, flexplanTab] : tabItems;

const ProjectTabbarView: FC<Props> = ({ id, project, config }) => {
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
      default:
        return <div />;
    }
  }, [config, id, project, value]);

  return (
    <div style={{ marginTop: 30 }}>
      <Tabs tabs={updatedTabItems} onTabClick={handleChange} />
      {renderContent()}
    </div>
  );
};

export default ProjectTabbarView;
