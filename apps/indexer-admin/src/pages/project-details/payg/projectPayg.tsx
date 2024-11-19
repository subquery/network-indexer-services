// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { BsInfoCircle } from 'react-icons/bs';
import { Modal, Spinner, Typography } from '@subql/components';
import { TOKEN_SYMBOLS } from '@subql/network-config';
import { Form, Input, Select, Tooltip } from 'antd';
import { useForm } from 'antd/es/form/Form';
import BigNumberJs from 'bignumber.js';
import { SubqlInput } from 'styles/input';

import { useContractSDK } from 'containers/contractSdk';
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
  const { paygConfig, changePAYGCofnig, loading, initializeLoading } = usePAYGConfig(id);
  const sdk = useContractSDK();
  const [showModal, setShowModal] = useState(false);
  const innerConfig = useMemo(() => {
    const { paygPrice, paygExpiration } = paygConfig;
    return { paygPrice, paygExpiration };
  }, [paygConfig]);
  const paygEnabled = useMemo(() => {
    return innerConfig.paygExpiration && innerConfig.paygPrice;
  }, [innerConfig]);

  const [form] = useForm();

  // const { rates, fetchedTime } = useStableCoin(sdk, SUPPORTED_NETWORK);

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

  if (initializeLoading)
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );

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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* <Typography variant="medium">
                  {paygConfig.paygPrice} {STABLE_COIN_SYMBOLS[SUPPORTED_NETWORK]}/1000 reqeusts
                  <br />
                </Typography>
                <Typography variant="medium" type="secondary">
                  = {BigNumber(paygConfig.paygPrice).multipliedBy(rates.usdcToSqt).toFixed()}{' '}
                  {TOKEN_SYMBOLS[SUPPORTED_NETWORK]} | {fetchedTime?.format('HH:mm:ss A')}
                </Typography> */}
              </div>
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
        onSubmit={async () => {
          await form.validateFields();
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
            <Tooltip title="Please note that this is just an indicative rate. The actual price depends on the exact exchange rate when consumer makes payment. The final payment will always be paid by SQT.">
              <BsInfoCircle style={{ marginLeft: 8, color: 'var(--sq-gray600)' }} />
            </Tooltip>
          </div>
          <Form
            form={form}
            initialValues={{
              price: paygConf.price,
              validity: paygConf.validity,
            }}
          >
            <SubqlInput>
              {sdk && (
                <Form.Item
                  name="price"
                  rules={[
                    {
                      validator: (_, value) => {
                        if (!value) {
                          return Promise.reject(new Error('Price is required'));
                        }
                        if (BigNumberJs(value).isLessThanOrEqualTo(0)) {
                          return Promise.reject(new Error('Price must be greater than 0'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <Input
                    value={paygConf.price}
                    onChange={(e) => {
                      form.setFieldValue('price', e.target.value);
                      setPaygConf({
                        ...paygConf,
                        price: e.target.value,
                      });
                    }}
                    type="number"
                    disabled={loading}
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
                          // {
                          //   value: STABLE_COIN_ADDRESS,
                          //   label: (
                          //     <div style={{ display: 'flex', alignItems: 'center' }}>
                          //       <img
                          //         style={{ width: 24, height: 24, marginRight: 8 }}
                          //         src="/images/usdc.png"
                          //         alt=""
                          //       />
                          //       <Typography>USDC</Typography>
                          //     </div>
                          //   ),
                          // },
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
                </Form.Item>
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
              <Form.Item
                name="validity"
                rules={[
                  {
                    validator: (_, value) => {
                      if (!value) {
                        return Promise.reject(new Error('Validity is required'));
                      }
                      if (BigNumberJs(value).isLessThan(1)) {
                        return Promise.reject(
                          new Error('Validity must be greater or equal than 1')
                        );
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  disabled={loading}
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
              </Form.Item>
            </SubqlInput>
          </Form>
        </div>
      </Modal>
    </Container>
  );
}
