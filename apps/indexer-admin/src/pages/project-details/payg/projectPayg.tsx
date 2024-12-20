// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { Spinner } from '@subql/components';

import { usePAYGConfig } from 'hooks/paygHook';

import { ProjectServiceMetadata } from '../types';
import { PAYGPlan } from './paygPlans';
import { Container } from './styles';

type TProjectPAYG = {
  id: string;
  config: ProjectServiceMetadata;
  paygUpdated?: () => void;
};

export function ProjectPAYG({ id }: TProjectPAYG) {
  const { paygConfig, initializeLoading } = usePAYGConfig(id);
  const innerConfig = useMemo(() => {
    const { paygPrice, paygExpiration } = paygConfig;
    return { paygPrice, paygExpiration };
  }, [paygConfig]);
  const paygEnabled = useMemo(() => {
    return innerConfig.paygExpiration && innerConfig.paygPrice;
  }, [innerConfig]);

  if (initializeLoading)
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );

  return (
    <Container style={{ paddingTop: 0 }}>
      {paygEnabled ? <PAYGPlan deploymentId={id} /> : ''}
    </Container>
  );
}
