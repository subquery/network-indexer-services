// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

// @ts-nocheck
import { useState } from 'react';
import {
  iNotificationDismiss,
  NOTIFICATION_TYPE,
  ReactNotifications,
  Store,
} from 'react-notifications-component';

import { createContainer } from './unstated';

import 'animate.css/animate.min.css';

export type Notification = {
  type: NOTIFICATION_TYPE;
  title: string;
  message: string;
  dismiss?: iNotificationDismiss;
};

export type notificationContext = {
  notification?: Notification;
  dispatchNotification: (info: Notification) => string;
  removeNotification: (id: string) => void;
};

function useNotificationImpl(): notificationContext {
  const [notification, setNotification] = useState<Notification>();
  const removeNotification = (id: string) => Store.removeNotification(id);

  const dispatchNotification = (info: Notification) => {
    setNotification(info);
    return Store.addNotification({
      title: info.title,
      message: info.message,
      type: info.type,
      container: 'top-right',
      animationIn: ['animate__animated', 'animate__fadeIn'],
      animationOut: ['animate__animated', 'animate__fadeOut'],
      dismiss: info.dismiss,
    });
  };

  return { notification, dispatchNotification, removeNotification };
}

export const Notifications = () => (
  <>
    <ReactNotifications />
  </>
);

export const notificationMsg = (info: Notification) => {
  const id = Store.addNotification({
    title: info.title,
    message: info.message,
    type: info.type,
    container: 'top-right',
    animationIn: ['animate__animated', 'animate__fadeIn'],
    animationOut: ['animate__animated', 'animate__fadeOut'],
    dismiss: info.dismiss,
  });

  return () => {
    Store.removeNotification(id);
  };
};

export const { useContainer: useNotification, Provider: NotificationProvider } = createContainer(
  useNotificationImpl,
  {
    displayName: 'Global Notification',
  }
);
