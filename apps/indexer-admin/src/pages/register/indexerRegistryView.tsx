// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Spinner, Typography } from '@subql/components';
import { formatSQT, renderAsync, useAsyncMemo } from '@subql/react-hooks';
import BigNumber from 'bignumber.js';
import { PER_MILL } from 'conf/constant';
import { Formik, FormikHelpers } from 'formik';
import * as yup from 'yup';

import { FieldItem } from 'components/formItem';
import { Button, ButtonContainer, FormContainer, Text } from 'components/primary';
import { useContractSDK } from 'containers/contractSdk';
import { initialRegisterValues, RegisterFormKey, TRegisterValues } from 'types/schemas';
import { parseError } from 'utils/error';
import { TOKEN_SYMBOL } from 'utils/web3';

import prompts from './prompts';
import { ContentContainer } from './styles';
import { RegisterStep } from './types';

type Props = {
  loading: boolean;
  onSubmit: (values: TRegisterValues, helper: FormikHelpers<TRegisterValues>) => void;
};

const IndexerRegistryView: FC<Props> = ({ onSubmit, loading }) => {
  const { title, buttonTitle } = prompts[RegisterStep.register];
  const contracts = useContractSDK();
  const minimumStake = useAsyncMemo(async () => {
    const res = await contracts?.indexerRegistry.minimumStakingAmount();

    return formatSQT(res?.toString() || '0');
  }, [contracts]);

  const minCommission = useAsyncMemo(async () => {
    if (!contracts) return 0;
    const minConmmissionRate = await contracts.indexerRegistry.minimumCommissionRate();

    return BigNumber(minConmmissionRate.toString()).div(PER_MILL).multipliedBy(100).toNumber();
  }, [contracts]);

  return (
    <ContentContainer>
      <Text mb={50} size={35} fw="bold">
        {title}
      </Text>
      {renderAsync(
        {
          data: minCommission,
          loading: minCommission.loading || minimumStake.loading,
        },
        {
          loading: () => (
            <div>
              <Spinner />
            </div>
          ),
          error: (error) => (
            <div>
              Error:
              {parseError(error, {
                alert: true,
              })}
            </div>
          ),
          data: () => {
            const RegisterFormSchema = yup.object({
              [RegisterFormKey.name]: yup.string().defined(),
              [RegisterFormKey.proxyEndpoint]: yup.string().defined(),
              [RegisterFormKey.amount]: yup
                .number()
                .min(
                  BigNumber(minimumStake.data ?? 200000).toNumber(),
                  `Staking token should large than ${BigNumber(minimumStake.data ?? 200000)
                    .toNumber()
                    .toLocaleString()} ${TOKEN_SYMBOL}`
                )
                .defined(),
              [RegisterFormKey.rate]: yup
                .number()
                .min(
                  minCommission.data ?? 0,
                  `Rate should be between ${minCommission.data ?? 0} and 100`
                )
                .max(100, `Rate should be between ${minCommission.data ?? 0} and 100`)
                .defined(),
            });

            return (
              <Formik
                initialValues={initialRegisterValues}
                validationSchema={RegisterFormSchema}
                onSubmit={onSubmit}
              >
                {({ errors, submitForm }) => (
                  <FormContainer>
                    <FieldItem
                      title="Indexer Name"
                      fieldKey={RegisterFormKey.name}
                      errors={errors}
                    />
                    <FieldItem
                      title={
                        <div>
                          Proxy Endpoint{' '}
                          <Typography.Link
                            type="info"
                            href="https://academy.subquery.network/subquery_network/node_operators/setup/becoming-a-node-operator.html#_2-setup-proxy-endpoint-to-public"
                            target="_blank"
                          >
                            Learn more here.
                          </Typography.Link>
                        </div>
                      }
                      fieldKey={RegisterFormKey.proxyEndpoint}
                      errors={errors}
                    />
                    <FieldItem
                      title="Staking Amount"
                      fieldKey={RegisterFormKey.amount}
                      errors={errors}
                    />
                    <FieldItem
                      title="Commission Rate (%)"
                      fieldKey={RegisterFormKey.rate}
                      errors={errors}
                    />
                    <ButtonContainer>
                      <Button
                        mt={20}
                        width={300}
                        title={buttonTitle}
                        loading={loading}
                        onClick={submitForm}
                      />
                    </ButtonContainer>
                  </FormContainer>
                )}
              </Formik>
            );
          },
        }
      )}
    </ContentContainer>
  );
};

export default IndexerRegistryView;
