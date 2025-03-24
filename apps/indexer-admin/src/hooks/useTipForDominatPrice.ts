// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useHistory } from 'react-router';
import { useMutation, useQuery } from '@apollo/client';
import { Modal } from 'antd';

import { GET_TIPS, SET_CONFIG } from 'utils/queries';

export const useTipForDominatPrice = () => {
  const history = useHistory();
  const [mounted, setMounted] = useState(false);
  const tips = useQuery<{ tips: { key: 'tip_dominant_price'; value: '1' | '0' }[] }>(GET_TIPS);

  const [setTips] = useMutation(SET_CONFIG);
  const checkAndTip = () => {
    if (mounted) return;
    if (tips.data) {
      const tip = tips?.data?.tips?.find((tip) => tip.key === 'tip_dominant_price');

      if (tip?.value === '1') {
        Modal.info({
          title: 'Set Default Flex Plan Price',
          content:
            "You haven't set the default price for the Flex Plan. Please set the default price to enable the Flex Plan.",
          cancelButtonProps: {
            style: { display: 'none' },
          },
          okText: 'Set Default Price',
          okButtonProps: {
            shape: 'round',
          },
          onOk: async () => {
            setMounted(true);

            await setTips({
              variables: {
                key: 'tip_dominant_price',
                value: '0',
              },
            });
            history.push('/config#flexplan');
          },
        });
      }
    }
  };

  return checkAndTip;
};
