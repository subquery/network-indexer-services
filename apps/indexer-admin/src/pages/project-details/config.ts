// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Notification } from 'containers/notificationContext';
import {
  initalPAYGValues,
  OpenPAYGFormKey,
  PaygEdit,
  ProjectFormKey,
  ProjectPaygSchema,
  StartIndexingSchema,
} from 'types/schemas';
import { dismiss, ProjectNotification } from 'utils/notification';
import { TOKEN_SYMBOL } from 'utils/web3';

import prompts from './prompts';
import {
  ClickAction,
  FormSubmit,
  PAYGAction,
  PaygStatus,
  ProjectAction,
  ProjectServiceMetadata,
  ProjectStatus,
} from './types';

const { project, announce, payg } = prompts;

export type ButtonItem = {
  title: string;
  action: () => void;
  options?: {
    color?: string;
    type?: 'primary' | 'secondary' | 'link';
    size?: 'large' | 'medium' | 'small';
  };
};

const createButtonItem = (
  title: string,
  action: () => void,
  options?: ButtonItem['options']
): ButtonItem => ({
  title,
  action,
  options,
});

export const createNetworkButtonItems = (onButtonClick: (type: ProjectAction) => void) => ({
  [ProjectStatus.NotIndexing]: [],
  [ProjectStatus.Starting]: [],
  [ProjectStatus.Started]: [
    createButtonItem('Announce Ready', () => onButtonClick(ProjectAction.AnnounceReady)),
  ],
  [ProjectStatus.Ready]: [
    createButtonItem('Announce Not Indexing', () =>
      onButtonClick(ProjectAction.AnnounceNotIndexing)
    ),
  ],
  [ProjectStatus.Terminated]: [
    createButtonItem('Announce Not Indexing', () =>
      onButtonClick(ProjectAction.AnnounceNotIndexing)
    ),
  ],
  [ProjectStatus.Unhealthy]: [
    createButtonItem('Announce Not Indexing', () =>
      onButtonClick(ProjectAction.AnnounceNotIndexing)
    ),
  ],
});

export const createServiceButtonItems = (onButtonClick: (type: ProjectAction) => void) => ({
  [ProjectStatus.NotIndexing]: [
    createButtonItem('Start Indexing', () => onButtonClick(ProjectAction.StartIndexing), {
      type: 'primary',
    }),
    createButtonItem('Remove Project', () => onButtonClick(ProjectAction.RemoveProject)),
  ],
  [ProjectStatus.Started]: [
    createButtonItem('Stop Project', () => onButtonClick(ProjectAction.StopProject)),
  ],
  [ProjectStatus.Starting]: [
    createButtonItem('Stop Project', () => onButtonClick(ProjectAction.StopProject)),
  ],
  [ProjectStatus.Indexing]: [
    createButtonItem('Update Indexing', () => onButtonClick(ProjectAction.RestartProject)),
    createButtonItem('Stop Indexing', () => onButtonClick(ProjectAction.StopIndexing)),
  ],
  [ProjectStatus.Ready]: [
    createButtonItem('Update Indexing', () => onButtonClick(ProjectAction.RestartProject)),
    createButtonItem('Stop Indexing', () => onButtonClick(ProjectAction.StopIndexing)),
  ],
  [ProjectStatus.Terminated]: [
    createButtonItem('Update Indexing', () => onButtonClick(ProjectAction.RestartProject)),
    createButtonItem('Remove Project', () => onButtonClick(ProjectAction.RemoveProject)),
  ],
  [ProjectStatus.Unhealthy]: [
    createButtonItem('Update Indexing', () => onButtonClick(ProjectAction.RestartProject)),
    createButtonItem('Remove Project', () => onButtonClick(ProjectAction.RemoveProject)),
  ],
});

export const createPaygButtonItems = (onButtonClick: (type: PAYGAction) => void) => ({
  [PaygStatus.Open]: [
    createButtonItem('Change price', () => onButtonClick(PAYGAction.PaygChangePrice)),
    createButtonItem('Close PAYG', () => onButtonClick(PAYGAction.PaygClose)),
  ],
  [PaygStatus.Close]: [createButtonItem('Open PAYG', () => onButtonClick(PAYGAction.PaygOpen))],
});

export const PAYGActionName = {
  [PAYGAction.PaygOpen]: 'Open PAYG',
  [PAYGAction.PaygChangePrice]: 'Change Price',
  [PAYGAction.PaygClose]: 'Close PAYG',
};

export const ProjectActionName = {
  [ProjectAction.StartIndexing]: 'Start Indexing',
  [ProjectAction.RestartProject]: 'Update Indexing',
  [ProjectAction.AnnounceReady]: 'Publish Indexing to Ready',
  [ProjectAction.StopProject]: 'Stop Project',
  [ProjectAction.RemoveProject]: 'Remove Project',
  [ProjectAction.AnnounceNotIndexing]: 'Announce Not Indexing Project',
  [ProjectAction.StopIndexing]: 'Stop Indexing',
};

export type ImageVersions = {
  node: string[];
  query: string[];
};

type Steps<T extends ProjectAction | PAYGAction> = {
  [key in T]: Array<{
    index: number;
    title: string;
    desc: string;
    buttonTitle: string;
    onClick: ClickAction;
  }>;
};

// TODO: refactor
const startProjectForms = (
  config: ProjectServiceMetadata,
  versions: ImageVersions,
  onFormSubmit: FormSubmit
) => ({
  formValues: undefined, // TODO: see restartIndexing form
  schema: StartIndexingSchema,
  onFormSubmit,
  items: [
    {
      formKey: ProjectFormKey.networkEndpoints,
      title: 'Indexing Network Endpoint',
      placeholder: 'wss://polkadot.api.onfinality.io/public-ws',
    },
    {
      formKey: ProjectFormKey.indexDictionary,
      title: 'Dictionary Project?',
      options: ['true', 'false'],
    },
    {
      formKey: ProjectFormKey.networkDictionary,
      title: 'Network Dictionary Endpoint',
      placeholder: 'https://api.subquery.network/sq/subquery/dictionary-polkadot',
    },
    {
      formKey: ProjectFormKey.nodeVersion,
      title: 'Node Image Version',
      options: versions.node,
    },
    {
      formKey: ProjectFormKey.queryVersion,
      title: 'Query Image Version',
      options: versions.query,
    },
    {
      formKey: ProjectFormKey.purgeDB,
      title: 'Enable Purge DB',
      options: ['true', 'false'],
    },
  ],
});

export const createStartIndexingSteps = (
  config: ProjectServiceMetadata,
  versions: ImageVersions,
  onStartProject: FormSubmit
) => ({
  [ProjectAction.StartIndexing]: [
    {
      index: 0,
      title: project.start.title,
      desc: project.start.desc,
      buttonTitle: 'Confirm',
      form: startProjectForms(config, versions, onStartProject),
      popupType: 'drawer',
      onClick: onStartProject,
    },
  ],
});

export const createRestartProjectSteps = (
  config: ProjectServiceMetadata,
  versions: ImageVersions,
  onStartProject: FormSubmit
) => ({
  [ProjectAction.RestartProject]: [
    {
      index: 0,
      title: project.restart.title,
      desc: project.restart.desc,
      buttonTitle: 'Confirm',
      popupType: 'drawer',
      form: startProjectForms(config, versions, onStartProject),
    },
  ],
});

export const createRemoveProjectSteps = (onRemoveProject: ClickAction) => ({
  [ProjectAction.RemoveProject]: [
    {
      index: 0,
      title: project.remove.title,
      desc: project.remove.desc,
      buttonTitle: 'Confirm',
      onClick: onRemoveProject,
    },
  ],
});

export const createReadyIndexingSteps = (
  onSendTransaction: ClickAction
): Steps<ProjectAction.AnnounceReady> => ({
  [ProjectAction.AnnounceReady]: [
    {
      index: 0,
      title: announce.ready.title,
      desc: announce.ready.desc,
      buttonTitle: 'Send Transaction',
      onClick: onSendTransaction,
    },
  ],
});

export const createNotIndexingSteps = (
  onSendTransaction: ClickAction
): Steps<ProjectAction.AnnounceNotIndexing> => ({
  [ProjectAction.AnnounceNotIndexing]: [
    {
      index: 0,
      title: announce.notIndexing.title,
      desc: announce.notIndexing.desc,
      buttonTitle: 'Send Transaction',
      onClick: onSendTransaction,
    },
  ],
});

export const createStopProjectSteps = (
  onStopProject: ClickAction
): Steps<ProjectAction.StopProject> => ({
  [ProjectAction.StopProject]: [
    {
      index: 0,
      title: project.stop.title,
      desc: project.stop.desc,
      buttonTitle: 'Confirm',
      onClick: onStopProject,
    },
  ],
});

export const createStopIndexingSteps = (
  onStopProject: ClickAction
): Steps<ProjectAction.StopIndexing> => ({
  [ProjectAction.StopIndexing]: [
    {
      index: 0,
      title: project.stop.title,
      desc: project.stop.desc,
      buttonTitle: 'Confirm',
      onClick: onStopProject,
    },
  ],
});

const setPaygPriceForms = (config: PaygEdit, onFormSubmit: FormSubmit) => ({
  formValues: initalPAYGValues(config),
  schema: ProjectPaygSchema,
  onFormSubmit,
  items: [
    {
      formKey: OpenPAYGFormKey.paygPrice,
      title: `Advertise a price per 1,000 requests (${TOKEN_SYMBOL})`,
      placeholder: '300',
    },
    {
      formKey: OpenPAYGFormKey.paygPeriod,
      title: 'Validity Period (days)',
      placeholder: 'Set a validity period',
    },
  ],
});

export const createPaygOpenSteps = (config: PaygEdit, onPaygOpen: FormSubmit) => ({
  [PAYGAction.PaygOpen]: [
    {
      index: 0,
      title: payg.open.title,
      desc: payg.open.desc,
      buttonTitle: 'Confirm',
      form: setPaygPriceForms(config, onPaygOpen),
    },
  ],
});

export const createPaygCloseSteps = (onPaygClose: ClickAction): Steps<PAYGAction.PaygClose> => ({
  [PAYGAction.PaygClose]: [
    {
      index: 0,
      title: prompts.paygClose.title,
      desc: prompts.paygClose.desc,
      buttonTitle: 'Confirm',
      onClick: onPaygClose,
    },
  ],
});

// inconsistent status config
export const alertMessages = {
  [ProjectStatus.Started]: {
    title: 'Ready to index the project on SubQuery Network',
    description:
      'The current project has already been started. Check the progress and logs to make sure indexing is going well. Try pressing the Announce Indexing button to announce indexing for this project on SubQuery Network. You can also try restarting indexing if something goes wrong.',
  },
  [ProjectStatus.Terminated]: {
    title: 'Inconsistent Status',
    description:
      'The current indexing service for this project has been terminated, but the indexing service status on the SubQuery Network still shows as "Indexing". We encourage you to click the "Announce Not Indexing" button to correct the online status to "Not Indexing".',
  },
  [ProjectStatus.Unhealthy]: {
    title: 'Inconsistent Status',
    description:
      'The current indexing service for this project has been terminated, but the indexing service status on the SubQuery Network still shows as "Indexing". We encourage you to click the "Announce Not Indexing" button to correct the online status to "Not Indexing".',
  },
};

// notification config
export const notifications: Record<string, Notification> = {
  [ProjectNotification.Started]: {
    type: 'success',
    title: 'Project is starting',
    message: `Starting the project may take around 5 seconds`,
    dismiss: dismiss(),
  },
  [ProjectNotification.Terminated]: {
    type: 'success',
    title: 'Project Terminated',
    message: `The project has been stopped, you can restart or update the status on the network to "Not Indexing"`,
    dismiss: dismiss(),
  },
};
