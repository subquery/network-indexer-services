// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FormSubmit, ProjectsAction, ServiceStatus } from 'pages/project-details/types';
import { initialProjectValues, ProjectFormKey, ProjectFormSchema } from 'types/schemas';

export const statusColor = {
  [ServiceStatus.TERMINATED]: 'rgba(214, 48, 48, 0.3)',
  [ServiceStatus.READY]: 'rgba(70, 219, 103, 0.4)',
};

export const statusText = {
  [ServiceStatus.TERMINATED]: 'NOT INDEXING',
  [ServiceStatus.READY]: 'READY',
};

export enum OnlineStatus {
  online = 'Accessible',
  offline = 'Inaccessible',
}

// TODO: remove the old logic
export const createAddProjectSteps = (onAddProject: FormSubmit) => ({
  [ProjectsAction.addProject]: [
    {
      index: 0,
      title: 'Add new project',
      desc: 'Input the deployment id, and add the project into you service. Your can manage the project in the projects page and start indexing the project at any time you want.',
      buttonTitle: 'Add project',
      form: {
        formValues: initialProjectValues,
        schema: ProjectFormSchema,
        onFormSubmit: onAddProject,
        items: [
          {
            formKey: ProjectFormKey.deploymentId,
            title: 'Deployment ID',
            placeholder: 'QmYDpk94SCgxv4j2PyLkaD8fWJpHwJufMLX2HGjefsNHH4',
          },
        ],
      },
    },
  ],
});
