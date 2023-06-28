// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import Modal from 'react-modal';
import { Steps } from 'antd';
import { Form, Formik } from 'formik';
import styled from 'styled-components';

import { StepItem, TModal, useModal } from 'containers/modalContext';
import { RegistrySteps } from 'pages/register/styles';
import { getStepStatus } from 'pages/register/utils';
import cross from 'resources/cross.svg';

import { FieldItem } from './formItem';
import Icon from './Icon';
import { Button, ButtonContainer, Text } from './primary';

const modalStyles = {
  content: {
    backgroundColor: 'white',
    borderRadius: 15,
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    maxWidth: 900,
    minWidth: 700,
    maxHeight: '90%',
    padding: 0,
  },
  overlay: {
    zIndex: 50,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
};

export const GModalView = () => {
  const { modalData } = useModal();
  if (!modalData || !modalData.visible) return null;

  return <ModalView {...modalData} />;
};

const ModalView: FC<TModal> = ({
  visible,
  title,
  onClose,
  currentStep = 0,
  steps,
  type,
  loading,
}) => {
  if (!steps || currentStep > steps.length - 1) return null;

  const stepItem = steps[currentStep];
  const renderFormContent = (item: StepItem) =>
    item.form ? (
      <Formik
        initialValues={item.form.formValues}
        validationSchema={item.form.schema}
        onSubmit={item.form.onFormSubmit}
      >
        {({ status, errors, submitForm, setFieldValue, initialValues }) => (
          <InputForm>
            <div>
              {item.form?.items.map(({ title = '', formKey = '', placeholder = '', options }) => (
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
              ))}
              {item.desc && (
                <Text mt={20} size={13} color="gray">
                  {item.desc}
                </Text>
              )}
            </div>
            <ButtonContainer align="right" mt={50}>
              <Button
                width={260}
                mt={0}
                title={item.buttonTitle}
                onClick={submitForm}
                loading={loading || status?.loading}
              />
            </ButtonContainer>
          </InputForm>
        )}
      </Formik>
    ) : null;

  const renderContent = (item: StepItem) => (
    <ContentContainer>
      <DescContainer>
        <Text fw="500" mt={10} size={25}>
          {item.title}
        </Text>
        <Text alignCenter mt={20} size={15} color="gray">
          {item.desc}
        </Text>
      </DescContainer>
      <ButtonContainer align="right" mt={60}>
        <Button
          width={200}
          title={item.buttonTitle}
          onClick={() => item.onClick && item.onClick(type)}
          loading={loading}
        />
      </ButtonContainer>
    </ContentContainer>
  );

  const renderHeader = () => (
    <HeaderContainer onClick={() => onClose && onClose()}>
      <Text fw="500" size={20}>
        {title}
      </Text>
      <IconContainer>
        <Icon size={18} src={cross} />
      </IconContainer>
    </HeaderContainer>
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
    <Modal isOpen={visible} style={modalStyles} closeTimeoutMS={200} ariaHideApp={false}>
      {renderHeader()}
      <Container>
        {renderSteps()}
        {stepItem.form ? renderFormContent(stepItem) : renderContent(stepItem)}
      </Container>
    </Modal>
  );
};

export default ModalView;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 32px;
  padding-bottom: 52px;
`;

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-content: center;
  padding: 16px 32px;
  border-bottom: 1px solid var(--sq-gray300);
`;

const IconContainer = styled.div`
  margin-top: 5px;
`;

const ModalSteps = styled(Steps)`
  width: 100%;
  min-width: 350px;
  margin-bottom: 40px;
`;

const InputForm = styled(Form)`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: space-between;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
`;

const DescContainer = styled.div`
  display: flex;
  width: 80%;
  flex-direction: column;
  align-items: center;
`;
