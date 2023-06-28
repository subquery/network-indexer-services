// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
import { useEffect } from 'react';
import { Redirect } from 'react-router';
import { useIsIndexer } from 'hooks/indexerHook';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useLoading } from 'containers/loadingContext';
import { isUndefined } from 'lodash';
import { Container } from './styles';
import { useAccount } from 'containers/account';

const LoginPage = () => {
  const { account } = useAccount();
  const isIndexer = useIsIndexer();
  const { setPageLoading } = useLoading();
  const { loading, load } = useCoordinatorIndexer();

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPageLoading(loading || isUndefined(isIndexer));
  }, [loading, isIndexer]);

  return (
    <Container>
      <div>
        {account && !isIndexer && <Redirect to="/register" />}
        {account && isIndexer && <Redirect to="/account" />}
      </div>
    </Container>
  );
};

export default LoginPage;
