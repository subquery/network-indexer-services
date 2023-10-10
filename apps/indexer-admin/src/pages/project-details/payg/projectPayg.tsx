// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { BsInfoCircle } from 'react-icons/bs';
import { Modal, Tooltip, Typography } from '@subql/components';
import { STABLE_COIN_SYMBOLS, TOKEN_SYMBOLS } from '@subql/network-config';
import { useStableCoin } from '@subql/react-hooks';
import { Input, Select } from 'antd';
import BigNumber from 'bignumber.js';
import { SubqlInput } from 'styles/input';

import { useContractSDK } from 'containers/contractSdk';
import { STABLE_COIN_ADDRESS } from 'containers/web3';
import { usePAYGConfig } from 'hooks/paygHook';
import { SUPPORTED_NETWORK, TOKEN_SYMBOL } from 'utils/web3';

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
  const { paygConfig, changePAYGCofnig } = usePAYGConfig(id);
  const sdk = useContractSDK();
  const [showModal, setShowModal] = useState(false);
  const innerConfig = useMemo(() => {
    const { paygPrice, paygExpiration } = paygConfig;
    return { paygPrice, paygExpiration };
  }, [paygConfig]);
  const paygEnabled = useMemo(() => {
    return innerConfig.paygExpiration && innerConfig.paygPrice;
  }, [innerConfig]);

  const { rates, fetchedTime } = useStableCoin(sdk, SUPPORTED_NETWORK);

  const [paygConf, setPaygConf] = useState({
    token: '',
    price: '',
    validity: '',
  });

  useEffect(() => {
    setPaygConf({
      price: paygConfig.paygPrice,
      validity: `${paygConfig.paygExpiration}`,
      token: paygConfig.token || sdk?.sqToken.address || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paygConfig, sdk]);

  return (
    <Container>
      {!paygEnabled && (
        <Introduction
          onEnablePayg={() => {
            setShowModal(true);
          }}
        />
      )}
      {paygEnabled ? (
        <PAYGConfig
          priceData={
            paygConfig.token === sdk?.sqToken.address ? (
              <Typography variant="medium">
                {paygConfig.paygPrice} {TOKEN_SYMBOLS[SUPPORTED_NETWORK]}/1000 reqeusts
              </Typography>
            ) : (
              <Typography variant="medium">
                {paygConfig.paygPrice} {STABLE_COIN_SYMBOLS[SUPPORTED_NETWORK]}/1000 reqeusts
                <br />
                <Typography variant="medium" type="secondary">
                  = {BigNumber(paygConfig.paygPrice).multipliedBy(rates.usdcToSqt).toFixed()}{' '}
                  {TOKEN_SYMBOLS[SUPPORTED_NETWORK]} | {fetchedTime?.format('HH:mm:ss A')}
                </Typography>
              </Typography>
            )
          }
          period={innerConfig.paygExpiration}
          onEdit={() => setShowModal(true)}
        />
      ) : (
        ''
      )}
      {paygEnabled ? <PAYGPlan deploymentId={id} /> : ''}

      <Modal
        open={showModal}
        okText="Enable"
        title="Enable Flex Plan"
        onOk={async () => {
          await changePAYGCofnig(paygConf);
          setShowModal(false);
        }}
        onCancel={() => {
          setShowModal(false);
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <Typography>Advertise a price per 1,000 requests</Typography>
            <Tooltip title="Please note that this is just an indicative rate. The actual price depends on the exact exchange rate when consumer makes payment. The final payment will always be paid by KSQT.">
              <BsInfoCircle style={{ marginLeft: 8, color: 'var(--sq-gray600)' }} />
            </Tooltip>
          </div>

          <SubqlInput>
            {sdk && (
              <Input
                value={paygConf.price}
                onChange={(e) => {
                  setPaygConf({
                    ...paygConf,
                    price: e.target.value,
                  });
                }}
                type="number"
                addonAfter={
                  <Select
                    value={paygConf.token}
                    onChange={(e) => {
                      setPaygConf({
                        ...paygConf,
                        token: e,
                      });
                    }}
                    options={[
                      {
                        value: STABLE_COIN_ADDRESS,
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <img
                              style={{ width: 24, height: 24, marginRight: 8 }}
                              src="/images/usdc.png"
                              alt=""
                            />
                            <Typography>USDC</Typography>
                          </div>
                        ),
                      },
                      {
                        value: sdk.sqToken.address,
                        label: (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <img
                              style={{ width: 24, height: 24, marginRight: 8 }}
                              src="/images/ksqt.svg"
                              alt=""
                            />
                            <Typography>{TOKEN_SYMBOL}</Typography>
                          </div>
                        ),
                      },
                    ]}
                  />
                }
              />
            )}
          </SubqlInput>

          <div style={{ marginTop: 24 }}>
            <Typography style={{ marginBottom: 8 }}>Validity Period</Typography>
            <Tooltip
              title={`Please note that this is just an indicative rate. The actual price depends on the exact exchange rate when consumer makes payment. The final payment will always be paid by ${TOKEN_SYMBOL}.`}
            >
              <BsInfoCircle style={{ marginLeft: 8, color: 'var(--sq-gray600)' }} />
            </Tooltip>
          </div>

          <SubqlInput>
            <Input
              value={paygConf.validity}
              onChange={(e) => {
                setPaygConf({
                  ...paygConf,
                  validity: e.target.value,
                });
              }}
              type="number"
              suffix={
                <Typography type="secondary" style={{ color: 'var(--sq-gray500)' }}>
                  Day(s)
                </Typography>
              }
            />
          </SubqlInput>
        </div>
      </Modal>
    </Container>
  );
}
