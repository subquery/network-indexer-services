// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';

import { noop, useModal } from 'containers/modalContext';
import { usePAYGConfig } from 'hooks/paygHook';

import { createPaygOpenSteps } from '../config';
import { ProjectServiceMetadata } from '../types';
import { PAYGConfig } from './paygConfig';
import { Introduction } from './paygIntroduction';
import { PAYGPlan } from './paygPlans';
import { Container } from './styles';

type TProjectPAYG = {
  id: string;
  config: ProjectServiceMetadata;
  paygUpdated?: () => void;
};

export function ProjectPAYG({ id }: TProjectPAYG) {
  const { paygConfig, changePAYGCofnig, loading } = usePAYGConfig(id);
  const { showModal, removeModal } = useModal();
  const innerConfig = useMemo(() => {
    const { paygPrice, paygExpiration } = paygConfig;
    return { paygPrice, paygExpiration };
  }, [paygConfig]);
  const paygEnabled = useMemo(() => {
    return innerConfig.paygExpiration && innerConfig.paygPrice;
  }, [innerConfig]);

  const paygOpenSteps = createPaygOpenSteps(innerConfig, async (value, helper) => {
    const res = await changePAYGCofnig(value, helper);

    if (res) {
      removeModal();
    }
  });

  const onUpdatePayg = (title: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const modalItem = {
      visible: true,
      steps: paygOpenSteps['Open PAYG'],
      title,
      loading,
      setVisible: noop,
    };
    showModal(modalItem);
  };

  return (
    <Container>
      {!paygEnabled && <Introduction onEnablePayg={() => onUpdatePayg('Enable Flex Plan')} />}
      {paygEnabled ? (
        <PAYGConfig
          price={innerConfig.paygPrice}
          period={innerConfig.paygExpiration}
          onEdit={() => onUpdatePayg('Update Flex Plan')}
        />
      ) : (
        ''
      )}
      {paygEnabled ? <PAYGPlan deploymentId={id} /> : ''}
    </Container>
  );
}
