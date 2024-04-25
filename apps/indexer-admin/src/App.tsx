// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Redirect, Route, Switch } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { loadDevMessages, loadErrorMessages } from '@apollo/client/dev';
import { Footer } from '@subql/components';
import { useMount } from 'ahooks';
import { RainbowProvider } from 'conf/rainbowConf';
import { useAccount } from 'wagmi';

import { ChainStatus, ConnectWallet } from 'components/ConnectWallet';
import ErrorPlaceholder from 'components/errorPlaceholder';
import Loading, { LoadingSpinner } from 'components/loading';
import { ContractSDKProvider } from 'containers/contractSdk';
import { CoordinatorIndexerProvider, useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { LoadingProvider } from 'containers/loadingContext';
import { ModalProvider } from 'containers/modalContext';
import { NotificationProvider, Notifications } from 'containers/notificationContext';
import { HasControllerProvider, useHasController } from 'hooks/useHasController';
import { coordinatorServiceUrl, createApolloClient } from 'utils/apolloClient';

import { GModalView } from './components/modalView';
import * as Pages from './pages';

import './polyfill/navigatorClip';
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
  const { loading: hasControllerLoading, refetch } = useHasController();

  // note this flow, after allow all wallet can be access, the coordinatorIndexer is a async fetch,
  // all of other components dependent the result.
  // and hasController also be dependent for otehr components.
  useMount(async () => {
    await load();
  });
  useEffect(() => {
    if (!loading) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

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

    if (loading || hasControllerLoading) return <LoadingSpinner />;

    return (
      <ChainStatus>
        <Switch>
          <Route component={Pages.Projects} path="/projects" />
          <Route exact component={Pages.ProjectDetail} path="/project/:id" />
          <Route component={Pages.Account} path="/account" />
          <Route component={Pages.ControllerManagement} path="/controller-management" />
          <Route component={Pages.Network} path="/network" />
          <Route component={Pages.Register} path="/register" />
          <Route exact path="/">
            <Redirect to="/account" />
          </Route>
        </Switch>
      </ChainStatus>
    );
  }, [hasControllerLoading, loading, error, address]);

  return (
    <>
      <Pages.Header />
      <div className="Main">
        {renderComs}
        <Notifications />
        <Loading />
        <GModalView />
      </div>
      <Footer simple />
    </>
  );
};

const App: FC = () => (
  <ApolloProvider client={createApolloClient(coordinatorServiceUrl)}>
    <RainbowProvider>
      <ContractSDKProvider>
        <CoordinatorIndexerProvider>
          <HasControllerProvider>
            <LoadingProvider>
              <ModalProvider>
                <NotificationProvider>
                  <div className="App">
                    <Router>
                      <AppContents />
                    </Router>
                  </div>
                </NotificationProvider>
              </ModalProvider>
            </LoadingProvider>
          </HasControllerProvider>
        </CoordinatorIndexerProvider>
      </ContractSDKProvider>
    </RainbowProvider>
  </ApolloProvider>
);

export default App;
