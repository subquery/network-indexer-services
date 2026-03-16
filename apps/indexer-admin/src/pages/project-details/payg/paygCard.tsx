// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { BsInfoCircle } from 'react-icons/bs';
import { IoWarning } from 'react-icons/io5';
import { useQuery } from '@apollo/client';
import { formatEther } from '@ethersproject/units';
import { Modal, Spinner, Typography } from '@subql/components';
import { TOKEN_SYMBOLS } from '@subql/network-config';
import { Button, Form, Input, Radio, Select, Tooltip } from 'antd';
import { useForm } from 'antd/es/form/Form';
import BigNumberJs from 'bignumber.js';
import { BigNumber } from 'ethers';
import { SubqlInput } from 'styles/input';

import { useContractSDK } from 'containers/contractSdk';
import { usePAYGConfig } from 'hooks/paygHook';
import { AllConfig, ConfigKey, GET_ALL_CONFIG } from 'utils/queries';
import { SUPPORTED_NETWORK, TOKEN_SYMBOL } from 'utils/web3';

import { CardContainer } from '../styles';
import { Introduction } from './paygIntroduction';

type TProjectPAYG = {
  id: string;
};

export function PaygCard({ id }: TProjectPAYG) {
  const { paygConfig, changePAYGCofnig, loading, initializeLoading, dominantPrice } =
    usePAYGConfig(id);
  const sdk = useContractSDK();
  const configQueryData = useQuery<AllConfig>(GET_ALL_CONFIG);
  const [showModal, setShowModal] = useState(false);
  const innerConfig = useMemo(() => {
    const { paygPrice, paygRatio, paygMinPrice, paygExpiration, useDefault } = paygConfig;
    return { paygPrice, paygExpiration, paygRatio, paygMinPrice, useDefault };
  }, [paygConfig]);
  const paygEnabled = useMemo(() => {
    return innerConfig.paygExpiration && innerConfig.paygPrice;
  }, [innerConfig]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [form] = useForm();

  const [paygConf, setPaygConf] = useState({
    token: '',
    price: '',
    priceRatio: 0,
    validity: '',
    minPrice: '',
    useDefault: false,
  });

  useEffect(() => {
    if (!showModal) {
      setPaygConf({
        priceRatio: paygConfig.paygRatio,
        price: paygConfig.paygPrice,
        minPrice: paygConfig.paygMinPrice,
        validity: `${paygConfig.paygExpiration}`,
        token: paygConfig.token || sdk?.sqToken.address || '',
        useDefault: paygConfig.useDefault,
      });
      form.setFieldValue('price', paygConfig.paygPrice);
      form.setFieldValue('minPrice', paygConfig.paygMinPrice);
      form.setFieldValue('priceRatio', paygConfig.paygRatio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paygConfig, sdk, showModal]);

  if (initializeLoading)
    return (
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  console.warn(paygConfig.paygMinPrice, dominantPrice?.price);
  return (
    <CardContainer>
      {!paygEnabled && (
        <Introduction
          onEnablePayg={() => {
            setShowModal(true);
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" style={{ display: 'flex', alignItems: 'center' }}>
            Flex Plan Pricing {innerConfig.useDefault ? '(use default)' : ''}
          </Typography>
          <span style={{ flex: 1 }} />
          <Button
            type="primary"
            size="large"
            shape="round"
            loading={submitLoading}
            onClick={() => setShowModal(true)}
          >
            Edit Flex Plan Pricing
          </Button>
        </div>
        <Typography variant="medium" type="secondary">
          Current dominant price: {formatEther(BigNumber.from(dominantPrice?.price || 0).mul(1000))}{' '}
          {TOKEN_SYMBOLS[SUPPORTED_NETWORK]} / 1000 reqeusts
          {dominantPrice?.lastError ? (
            <Tooltip
              title={`Fetch dominant price failed, the minimum acceptable price is used as the price for the flex plan. Error: ${dominantPrice.lastError}`}
            >
              <IoWarning style={{ color: 'var(--sq-warning)', fontSize: 24, flexShrink: 0 }} />
            </Tooltip>
          ) : (
            ''
          )}
        </Typography>
        <Typography variant="medium" type="secondary">
          Price ratio: {paygConf.priceRatio}% (
          <Typography variant="medium" type="secondary">
            {paygConfig.token === sdk?.sqToken.address ? (
              <Typography variant="medium" type="secondary">
                {BigNumberJs(
                  formatEther(
                    BigNumberJs(dominantPrice?.price || 0)
                      .multipliedBy(1000)
                      .toString()
                  )
                )
                  .multipliedBy(paygConf.priceRatio)
                  .multipliedBy(0.01)
                  .toString()}{' '}
                {TOKEN_SYMBOLS[SUPPORTED_NETWORK]} / 1000 reqeusts
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
            )}
          </Typography>
          )
        </Typography>
        <Typography
          variant="medium"
          type="secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          Minimum pricing:{' '}
          {paygConfig.token === sdk?.sqToken.address ? (
            <Typography variant="medium" type="secondary">
              {paygConfig.paygMinPrice} {TOKEN_SYMBOLS[SUPPORTED_NETWORK]} / 1000 reqeusts
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
          )}
          {BigNumberJs(
            formatEther(
              BigNumberJs(dominantPrice?.price || 0)
                .multipliedBy(1000)
                .toString()
            )
          ).lt(paygConfig.paygMinPrice) ? (
            <Tooltip title="The minimum pricing greater than the dominant price, you will not receive any flex plan, consider reduce the minimum pricing.">
              <IoWarning style={{ color: 'var(--sq-warning)', fontSize: 24, flexShrink: 0 }} />
            </Tooltip>
          ) : (
            ''
          )}
        </Typography>

        {/* <Typography variant="medium" type="secondary">
          Maximum validity period: {innerConfig.paygExpiration} days
        </Typography> */}
      </div>

      <Modal
        open={showModal}
        okText="Save"
        title="Edit Flex Plan"
        onSubmit={async () => {
          try {
            setSubmitLoading(true);
            await form.validateFields();
            await changePAYGCofnig(paygConf);
            setShowModal(false);
          } finally {
            setSubmitLoading(false);
          }
        }}
        onCancel={() => {
          setShowModal(false);
        }}
      >
        <div
          style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          onClick={() => {
            setPaygConf({
              ...paygConf,
              priceRatio: +(
                configQueryData.data?.allConfig.find(
                  (item) => item.key === ConfigKey.FlexPriceRatio
                )?.value || 80
              ),
              price:
                configQueryData.data?.allConfig.find((item) => item.key === ConfigKey.FlexPrice)
                  ?.value || '0.5',
              useDefault: true,
            });
          }}
          aria-hidden="true"
        >
          <div className="col-flex" style={{ gap: 8 }}>
            <Radio value="default" checked={paygConf.useDefault}>
              <Typography weight={500} variant="large">
                Default
              </Typography>
            </Radio>
            <Typography variant="medium" style={{ maxWidth: 450 }} type="secondary">
              Set with default flex plan setting.
            </Typography>
          </div>
        </div>

        <div
          style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}
          onClick={() => {
            setPaygConf({
              ...paygConf,
              useDefault: false,
            });
          }}
          aria-hidden="true"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Radio value="custom" checked={paygConf.useDefault === false}>
              <Typography weight={500} variant="large">
                Custom
              </Typography>
            </Radio>
            <div
              style={{
                display: paygConf.useDefault === false ? 'flex' : 'none',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Typography variant="medium" style={{ maxWidth: 450 }} type="secondary">
                Advertise a price per 1,000 requests
              </Typography>
              <Tooltip title="Please note that this is just an indicative rate. The actual price depends on the exact exchange rate when consumer makes payment. The final payment will always be paid by SQT.">
                <BsInfoCircle style={{ marginLeft: 8, color: 'var(--sq-gray600)' }} />
              </Tooltip>
            </div>
            <Form
              style={{
                display: paygConf.useDefault === false ? 'block' : 'none',
              }}
              form={form}
              initialValues={{
                minPrice: paygConf.minPrice,
                priceRatio: paygConf.priceRatio,
                price: paygConf.price,
                validity: paygConf.validity,
              }}
              layout="vertical"
            >
              <SubqlInput>
                {sdk && (
                  <Form.Item
                    name="priceRatio"
                    label="Price Ratio"
                    rules={[
                      {
                        validator: (_, value) => {
                          if (!value) {
                            return Promise.reject(new Error('Price ratio is required'));
                          }
                          if (BigNumberJs(value).isLessThanOrEqualTo(0)) {
                            return Promise.reject(new Error('Price ratio must be greater than 0'));
                          }
                          if (BigNumberJs(value).isGreaterThan(100)) {
                            return Promise.reject(new Error('Price ratio must be less than 100'));
                          }
                          if (!BigNumberJs(value).isInteger()) {
                            return Promise.reject(new Error('Price ratio must be integer'));
                          }
                          return Promise.resolve();
                        },
                      },
                    ]}
                  >
                    <Input
                      value={paygConf.priceRatio}
                      onChange={(e) => {
                        form.setFieldValue('priceRatio', e.target.value);
                        setPaygConf({
                          ...paygConf,
                          priceRatio: +e.target.value,
                        });
                      }}
                      type="number"
                      disabled={loading}
                      suffix="%"
                    />
                  </Form.Item>
                )}
              </SubqlInput>
              <SubqlInput>
                {sdk && (
                  <Form.Item
                    name="minPrice"
                    label="Minimum Price"
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
                      value={paygConf.minPrice}
                      onChange={(e) => {
                        form.setFieldValue('minPrice', e.target.value);
                        setPaygConf({
                          ...paygConf,
                          minPrice: e.target.value,
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

              <SubqlInput style={{ display: 'none' }}>
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
        </div>
      </Modal>
    </CardContainer>
  );
}
