// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
import { Redirect } from 'react-router';
import { useIsIndexer } from 'hooks/indexerHook';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { isUndefined } from 'lodash';
import { Container } from './styles';
import { useAccount } from 'containers/account';
import ErrorPlaceholder from 'components/errorPlaceholder';
import { LoadingSpinner } from 'components/loading';

const LoginPage = () => {
  const { account } = useAccount();
  const isIndexer = useIsIndexer();
  const { loading, error } = useCoordinatorIndexer();

  if (error || isUndefined(isIndexer)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <ErrorPlaceholder />
      </div>
    );
  }

  return (
    <Container>
      {loading || isUndefined(isIndexer) ? (
        <LoadingSpinner />
      ) : (
        <div>
          {account && !isIndexer && <Redirect to="/register" />}
          {account && isIndexer && <Redirect to="/account" />}
        </div>
      )}
    </Container>
  );
};

export default LoginPage;
