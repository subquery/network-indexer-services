// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Dispatch, FC, SetStateAction } from 'react';
import { Button } from '@subql/components';
import { Drawer, Modal, Steps, Typography } from 'antd';
import { Form, Formik } from 'formik';
import styled from 'styled-components';

import { StepItem, TModal } from 'containers/modalContext';
import { ModalAction, ProjectAction } from 'pages/project-details/types';
import { RegistrySteps } from 'pages/register/styles';
import { getStepStatus } from 'pages/register/utils';

import { IndexingForm } from './forms/restartIndexing';
import { FieldItem } from './formItem';
import { ButtonContainer, Text } from './primary';

const Title: FC<{ title: string }> = ({ title }) => (
  <Typography.Title level={4} style={{ marginBottom: 0 }}>
    {title || 'Modal'}
  </Typography.Title>
);

interface PopupView {
  visible: boolean;
  title: string;
  onClose: () => void;
  stepItem: StepItem;
  type: string;
  loading: boolean;
}

const PopupContent: FC<{
  setVisible: Dispatch<SetStateAction<boolean>>;
  type: ModalAction | undefined;
  steps: StepItem[];
  currentStep: number;
  loading: boolean | undefined;
}> = ({ setVisible, steps, currentStep, type, loading }) => {
  if (!steps || currentStep > steps.length - 1) return null;
  const stepItem = steps[currentStep];

  // TODO: remove Formik stuff and put all forms in form folder
  // then in config point to form component instead of rendering dynamically with map
  const renderFormContent = (
    loading: boolean | undefined,
    item: StepItem,
    setVisible: Dispatch<SetStateAction<boolean>>,
    type: ModalAction | undefined
  ) => {
    // TODO: refactor this
    if (type && (type === ProjectAction.RestartProject || type === ProjectAction.StartIndexing)) {
      return <IndexingForm setVisible={setVisible} />;
    }

    return (
      <ContentContainer>
        {item?.form && (
          <Formik
            initialValues={item.form.formValues}
            validationSchema={item.form.schema}
            onSubmit={item.form.onFormSubmit}
          >
            {({ status, errors, submitForm, setFieldValue, initialValues }) => (
              <InputForm>
                <div>
                  {item.form?.items.map(
                    ({ title = '', formKey = '', placeholder = '', options }) => (
                      <FieldItem
                        key={title}
                        title={title}
                        fieldKey={formKey}
                        initialValue={initialValues[formKey]}
                        placeholder={placeholder}
                        setFieldValue={setFieldValue}
                        options={options}
                        errors={errors}
                      />
                    )
                  )}
                  {item.desc && (
                    <Text size={13} color="gray">
                      {item.desc}
                    </Text>
                  )}
                  <ButtonContainer align="right" mt={20}>
                    <Button
                      label={stepItem?.buttonTitle ?? 'Confirm'}
                      type="secondary"
                      onClick={submitForm}
                      loading={loading || status?.loading}
                    />
                  </ButtonContainer>
                </div>
              </InputForm>
            )}
          </Formik>
        )}
      </ContentContainer>
    );
  };

  const renderContent = (item: StepItem) => (
    <ContentContainer>
      <DescContainer>
        <Text fw="500" mt={20} size={25}>
          {item.title}
        </Text>
        <Text alignCenter mt={20} size={15} color="gray">
          {item.desc}
        </Text>
      </DescContainer>
      <ButtonContainer align="right" mt={30}>
        <Button
          label={stepItem?.buttonTitle ?? 'Confirm'}
          type="secondary"
          onClick={() => item.onClick && item.onClick(type)}
          loading={loading}
        />
      </ButtonContainer>
    </ContentContainer>
  );

  const renderSteps = () =>
    steps?.length > 1 && (
      <ModalSteps size="small" current={currentStep}>
        {steps.map((item, i) => (
          <RegistrySteps.Step
            key={item.title}
            status={getStepStatus(currentStep, i)}
            title={item.buttonTitle}
          />
        ))}
      </ModalSteps>
    );

  return (
    <>
      {renderSteps()}
      {stepItem.form
        ? renderFormContent(loading, stepItem, setVisible, type)
        : renderContent(stepItem)}
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const PopupView: FC<TModal> = ({
  steps,
  currentStep,
  title,
  onClose,
  type,
  loading,
  visible,
  setVisible,
}) => {
  const stepItem = steps[currentStep ?? 0];
  const popupType = stepItem?.popupType ?? 'modal';

  return (
    <>
      {popupType === 'drawer' && (
        <Drawer
          open={visible}
          rootClassName="popupViewDrawer"
          width="30%"
          onClose={onClose}
          title={<Title title={title ?? ''} />}
          footer={null}
        >
          <PopupContent
            setVisible={setVisible}
            loading={loading}
            type={type}
            steps={steps ?? []}
            currentStep={0}
          />
        </Drawer>
      )}

      {popupType === 'modal' && (
        <Modal open={visible} width="40%" onCancel={onClose} footer={null}>
          <PopupContent
            setVisible={setVisible}
            loading={loading}
            type={type}
            steps={steps ?? []}
            currentStep={0}
          />
        </Modal>
      )}
    </>
  );
};

const ModalSteps = styled(Steps)`
  width: 100%;
  min-width: 350px;
  margin-bottom: 40px;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
`;

const DescContainer = styled.div`
  display: flex;
  padding: 10px;
  flex-direction: column;
  align-items: center;
`;

const InputForm = styled(Form)`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
  margin-top: 20px;
`;
