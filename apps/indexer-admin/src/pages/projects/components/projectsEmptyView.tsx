// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Typography } from '@subql/components';
import styled from 'styled-components';

import IntroductionView from 'components/introductionView';
import { SUPPORTED_NETWORK_PROJECTS_EXPLORER } from 'utils/web3';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: flex-start;
  margin-top: 80px;
`;

type Props = {
  onClick: () => void;
};

const ExplorerLink = () => (
  <Typography.Link href={SUPPORTED_NETWORK_PROJECTS_EXPLORER} rel="noreferrer" active>
    here.
  </Typography.Link>
);

const EmptyView: FC<Props> = ({ onClick }) => {
  return (
    <Container>
      <IntroductionView
        item={{
          title: 'Start to index a Subquery project',
          desc: 'To begin exploring query projects, go to the Subquery Explorer. Select the project that interests you and copy its deployment ID from the page. Next, click the "Add Project" button and paste in the deployment ID. This will add the project to your coordinator service, allowing you to manage it in the indexer app. Learn more about the indexer',
          buttonTitle: 'Add Project',
        }}
        onClick={() => {
          onClick();
        }}
        link={ExplorerLink()}
      />
    </Container>
  );
};

export default EmptyView;
