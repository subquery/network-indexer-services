// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { useLazyQuery, useMutation } from '@apollo/client';
import { cloneDeep, isEmpty, isUndefined } from 'lodash';

import IntroductionView from 'components/introductionView';
import { PopupView } from 'components/popupView';
import { Button, Text } from 'components/primary';
import { useLoading } from 'containers/loadingContext';
import { useNotification } from 'containers/notificationContext';
import { useController } from 'hooks/indexerHook';
import { useAccountAction } from 'hooks/transactionHook';
import {
  ADD_CONTROLLER,
  GET_CONTROLLERS,
  REMOVE_CONTROLLER,
  WITHDRAW_CONTROLLER,
} from 'utils/queries';

import {
  createConfigControllerSteps,
  createRemoveAccountSteps,
  createWithdrawSteps,
  withdrawControllerFailed,
  withdrawControllerLoading,
  withdrawControllerSucceed,
} from './config';
import ControllerItem from './controllerItem';
import { prompts } from './prompts';
import { Container, ContentContainer, HeaderContainer, IntroContainer } from './styles';
import { Controller, ControllerAction } from './types';

const controllersPage = () => {
  const { header, intro } = prompts;
  const [actionType, setActionType] = useState<ControllerAction>();
  const [account, setAccount] = useState<Controller>();
  const [controllers, setControllers] = useState<Controller[]>([]);
  const [visible, setVisible] = useState(false);

  const { dispatchNotification, removeNotification } = useNotification();
  const { controller: currentController, getController } = useController();
  const accountAction = useAccountAction();
  const { setPageLoading } = useLoading();

  const [removeController] = useMutation(REMOVE_CONTROLLER);
  const [createController, { loading: createControllerRequesting }] = useMutation(ADD_CONTROLLER);
  const [withdrawController] = useLazyQuery(WITHDRAW_CONTROLLER);
  const [getControllers, { data: controllerData }] = useLazyQuery<{ controllers: Controller[] }>(
    GET_CONTROLLERS
  );

  useEffect(() => {
    setPageLoading(isUndefined(controllerData));
    if (!controllerData) getControllers();
  }, [controllerData, getControllers, setPageLoading]);

  useEffect(() => {
    if (!controllerData || isEmpty(controllerData?.controllers)) return;

    const isActivedController = (address: string): boolean => {
      return address.toLowerCase() === currentController?.toLowerCase();
    };

    const rawControllers = cloneDeep(controllerData?.controllers);
    const index = rawControllers.findIndex((c) => isActivedController(c.address));
    if (index !== -1) {
      const [item] = rawControllers.splice(index, 1);
      rawControllers.unshift(item);
    }

    setControllers(rawControllers);
  }, [controllerData, currentController]);

  const createControllerAction = async () => {
    await createController();
    await getControllers();
  };

  const onButtonPress = (type: ControllerAction) => (a: Controller) => {
    setAccount(a);
    setActionType(type);
    setVisible(true);
  };

  const onModalClose = () => setVisible(false);

  const removeAccountSteps = createRemoveAccountSteps(async () => {
    await removeController({ variables: { id: account?.id } });
    setControllers(controllers.filter((c) => c.id !== account?.id));
    onModalClose();
  });

  const withdrawSteps = createWithdrawSteps(async () => {
    onModalClose();
    const address = account?.address;
    const notificationId = dispatchNotification(withdrawControllerLoading(address));

    const res = await withdrawController({ variables: { id: account?.id } });
    removeNotification(notificationId);
    if (res.data.withrawController) {
      dispatchNotification(withdrawControllerSucceed(address));
    } else {
      dispatchNotification(withdrawControllerFailed(address));
    }
    await getControllers();
  });

  const configControllerSteps = createConfigControllerSteps(() =>
    accountAction(
      ControllerAction.configController,
      account?.address ?? '',
      onModalClose,
      getController
    )
  );

  const steps = { ...configControllerSteps, ...withdrawSteps, ...removeAccountSteps };

  return (
    <Container>
      {!isEmpty(controllers) && (
        <HeaderContainer>
          <ContentContainer>
            <Text size={30} fw="bold" mr={20}>
              {header.mainTitle}
            </Text>
            <Text color="gray" mt={5}>
              {header.title}
            </Text>
            <Text color="gray">{header.subTitle}</Text>
          </ContentContainer>
          <Button
            title={header.button}
            type="primary"
            loading={createControllerRequesting}
            onClick={createControllerAction}
          />
        </HeaderContainer>
      )}
      {!isEmpty(controllers) && (
        <ContentContainer mt={50}>
          {!!controllers &&
            controllers.map((item, index) => (
              <ControllerItem
                key={item.id}
                controller={currentController}
                name={`Account ${index + 1}`}
                onConfigController={onButtonPress(ControllerAction.configController)}
                onRemoveController={onButtonPress(ControllerAction.removeAccount)}
                onWithdraw={onButtonPress(ControllerAction.withdraw)}
                {...item}
              />
            ))}
        </ContentContainer>
      )}
      {isEmpty(controllers) && (
        <IntroContainer>
          <IntroductionView
            item={{
              title: intro.title,
              desc: intro.desc,
              buttonTitle: intro.buttonTitle,
            }}
            onClick={createControllerAction}
          />
        </IntroContainer>
      )}
      {actionType && (
        <PopupView
          setVisible={setVisible}
          visible={visible}
          onClose={onModalClose}
          steps={steps[actionType]}
          type={actionType}
        />
      )}
    </Container>
  );
};

export default controllersPage;
