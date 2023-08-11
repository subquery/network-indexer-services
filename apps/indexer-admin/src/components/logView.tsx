// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, VFC } from 'react';
import { useLazyQuery } from '@apollo/client';
import { LogViewer } from '@patternfly/react-log-viewer';
import { Button, Spinner } from '@subql/components';
import styled from 'styled-components';

import { GET_LOG } from 'utils/queries';

type Props = {
  container: string;
  height: number;
};

const LogView: VFC<Props> = ({ container, height = 650 }) => {
  const [getLog, { loading, data, error }] = useLazyQuery(GET_LOG, {
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    getLog({ variables: { container } });
  }, [container, getLog]);

  const log = useMemo(() => {
    if (loading || error) return '';
    return data?.getLog.log;
  }, [data?.getLog.log, error, loading]);

  return (
    <Container height={height}>
      <StyledButton
        size="small"
        type="secondary"
        label="Refresh"
        onClick={() => getLog({ variables: { container } })}
      />
      {!!log && (
        <LogViewer hasLineNumbers height={height - 100} data={log} isTextWrapped theme="dark" />
      )}
      {loading && <Spinner />}
    </Container>
  );
};

export default LogView;

const Container = styled.div<{ height: number }>`
  height: ${({ height }) => height}px;
  padding: 30px;
  margin-top: 10px;
  background-color: var(--sq-gray900);
  align-items: center;
`;

const StyledButton = styled(Button)`
  margin-bottom: 20px;
  height: 30px;
  width: 100px;
  margin-right: 20px;
`;
