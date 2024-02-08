// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useState, VFC } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';

import ServiceLogView from 'components/logView';

enum TabbarItem {
  ServiceLog,
}

const NetworkTabbarView: VFC = () => {
  const [value, setValue] = useState<TabbarItem>(TabbarItem.ServiceLog);

  const handleChange = (_: any, newValue: TabbarItem) => {
    setValue(newValue);
  };

  const renderContent = useCallback(() => {
    switch (value) {
      default:
        return <ServiceLogView height={500} container="indexer_coordinator" />;
    }
  }, [value]);

  return (
    <div style={{ marginTop: 30 }}>
      <Tabs value={value} onChange={handleChange} textColor="primary" indicatorColor="primary">
        <Tab value={TabbarItem.ServiceLog} label="Service Log" />
      </Tabs>
      {renderContent()}
    </div>
  );
};

export default NetworkTabbarView;
