// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Dispatch, SetStateAction, useState } from 'react';
import { FormikValues } from 'formik';
import { ObjectSchema } from 'yup';

import { ClickAction, FormSubmit, ModalAction } from 'pages/project-details/types';

import { createContainer } from './unstated';

export type TFieldItem = {
  title: string;
  formKey: string;
  value?: string | number;
  placeholder?: string;
  options?: string[];
};

export type FormConfig = {
  placeHolder?: string;
  formValues: FormikValues;
  schema: ObjectSchema<any>;
  onFormSubmit: FormSubmit;
  items: TFieldItem[];
};

export type StepItem = {
  index: number;
  title: string;
  desc: string;
  popupType?: 'modal' | 'drawer';
  buttonTitle: string;
  onClick?: ClickAction;
  form?: FormConfig;
};

export type TModal = {
  visible: boolean;
  setVisible: Dispatch<SetStateAction<boolean>>;
  steps: StepItem[];
  title?: string;
  currentStep?: number;
  loading?: boolean;
  type?: ModalAction;
  onClose?: () => void;
};

type TModalContext = {
  modalData: TModal | undefined;
  showModal: (data: TModal) => void;
  removeModal: () => void;
};

export const noop = () => ({});

function useModalImpl(): TModalContext {
  const [modalData, setModalData] = useState<TModal>();
  const removeModal = () => setModalData({ visible: false, steps: [], setVisible: noop });
  const showModal = (data: TModal) => setModalData({ ...data, onClose: removeModal });

  return { modalData, showModal, removeModal };
}

export const { useContainer: useModal, Provider: ModalProvider } = createContainer(useModalImpl, {
  displayName: 'Global Modal',
});
