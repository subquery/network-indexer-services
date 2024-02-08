// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { loadDevMessages, loadErrorMessages } from '@apollo/client/dev';
import { Footer } from '@subql/components';
import { useMount } from 'ahooks';
import { RainbowProvider } from 'conf/rainbowConf';
import { useAccount } from 'wagmi';

import { ChainStatus, ConnectWallet } from 'components/ConnectWallet';
import ErrorPlaceholder from 'components/errorPlaceholder';
import Loading, { LoadingSpinner } from 'components/loading';
import { AccountProvider } from 'containers/account';
import { ContractSDKProvider } from 'containers/contractSdk';
import { CoordinatorIndexerProvider, useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { LoadingProvider } from 'containers/loadingContext';
import { ModalProvider } from 'containers/modalContext';
import { NotificationProvider, Notifications } from 'containers/notificationContext';
import { coordinatorServiceUrl, createApolloClient } from 'utils/apolloClient';

import { GModalView } from './components/modalView';
import * as Pages from './pages';

import 'react-notifications-component/dist/theme.css';
import 'antd/dist/reset.css';
import './App.css';
import '@subql/components/dist/subquery-components.css';

// Adds messages only in a dev environment
loadDevMessages();
loadErrorMessages();

const AppContents = () => {
  const { address } = useAccount();
  const { load, loading, error } = useCoordinatorIndexer();

  useMount(() => {
    load();
  });
  // load flow:
  //   if wallet disconnected, show connect wallet page // !address
  //      if rpc is wrong, show change rpc page // in ChainStatus.tsx
  //      wait for the coordinator load end.
  //           if error: show error tips
  //           if loading: show loading
  //      others show the page content

  const renderComs = useMemo(() => {
    if (!address)
      return (
        <div style={{ margin: '0 auto' }}>
          <ConnectWallet />
        </div>
      );

    if (!loading && error)
      return (
        <div style={{ margin: '0 auto' }}>
          <ErrorPlaceholder />
        </div>
      );
    if (loading) return <LoadingSpinner />;
    return (
      <ChainStatus>
        <Switch>
          <Route component={Pages.Projects} path="/projects" />
          <Route exact component={Pages.ProjectDetail} path="/project/:id" />
          <Route component={Pages.Account} path="/account" />
          <Route component={Pages.ControllerManagement} path="/controller-management" />
          <Route component={Pages.Network} path="/network" />
          <Route component={Pages.Register} path="/register" />
          <Route component={Pages.Login} path="/" />
        </Switch>
      </ChainStatus>
    );
  }, [loading, error, address]);

  return (
    <Router>
      <Pages.Header />
      <div className="Main">
        {renderComs}
        <Notifications />
        <Loading />
        <GModalView />
      </div>
      <Footer simple />
    </Router>
  );
};

const App: FC = () => (
  <ApolloProvider client={createApolloClient(coordinatorServiceUrl)}>
    <RainbowProvider>
      <ContractSDKProvider>
        <CoordinatorIndexerProvider>
          <AccountProvider>
            <LoadingProvider>
              <ModalProvider>
                <NotificationProvider>
                  <div className="App">
                    <AppContents />
                  </div>
                </NotificationProvider>
              </ModalProvider>
            </LoadingProvider>
          </AccountProvider>
        </CoordinatorIndexerProvider>
      </ContractSDKProvider>
    </RainbowProvider>
  </ApolloProvider>
);

export default App;
