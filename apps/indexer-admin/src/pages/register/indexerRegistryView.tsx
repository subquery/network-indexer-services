// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Formik, FormikHelpers } from 'formik';

import { FieldItem } from 'components/formItem';
import { Button, ButtonContainer, FormContainer, Text } from 'components/primary';
import {
  initialRegisterValues,
  RegisterFormKey,
  RegisterFormSchema,
  TRegisterValues,
} from 'types/schemas';

import prompts from './prompts';
import { ContentContainer } from './styles';
import { RegisterStep } from './types';

type Props = {
  loading: boolean;
  onSubmit: (values: TRegisterValues, helper: FormikHelpers<TRegisterValues>) => void;
};

const IndexerRegistryView: FC<Props> = ({ onSubmit, loading }) => {
  const { title, buttonTitle } = prompts[RegisterStep.register];
  return (
    <ContentContainer>
      <Text mb={50} size={35} fw="bold">
        {title}
      </Text>
      <Formik
        initialValues={initialRegisterValues}
        validationSchema={RegisterFormSchema}
        onSubmit={onSubmit}
      >
        {({ errors, submitForm }) => (
          <FormContainer>
            <FieldItem title="Indexer Name" fieldKey={RegisterFormKey.name} errors={errors} />
            <FieldItem
              title="Proxy Endpoint"
              fieldKey={RegisterFormKey.proxyEndpoint}
              errors={errors}
            />
            <FieldItem title="Staking Amount" fieldKey={RegisterFormKey.amount} errors={errors} />
            <FieldItem
              title="Commission Rate (%)"
              fieldKey={RegisterFormKey.rate}
              errors={errors}
            />
            <ButtonContainer>
              <Button
                mt={20}
                width={300}
                type="primary"
                title={buttonTitle}
                loading={loading}
                onClick={submitForm}
              />
            </ButtonContainer>
          </FormContainer>
        )}
      </Formik>
    </ContentContainer>
  );
};

export default IndexerRegistryView;
