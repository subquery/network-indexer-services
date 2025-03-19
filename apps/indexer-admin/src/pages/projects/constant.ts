// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FormSubmit, ProjectsAction, ServiceStatus } from 'pages/project-details/types';
import { initialProjectValues, ProjectFormKey, ProjectFormSchema } from 'types/schemas';

export const statusColor = {
  [ServiceStatus.TERMINATED]: 'var(--sq-gray200)',
  [ServiceStatus.READY]: 'rgba(101, 205, 69, 0.08)',
};

export const statusText = {
  [ServiceStatus.TERMINATED]: 'Offline',
  [ServiceStatus.READY]: 'Online',
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
      desc: 'Input the deployment id, and add the project into your service. You can manage the project in the projects page and start indexing the project at any time you want.',
      buttonTitle: 'Add project',
      form: {
        formValues: initialProjectValues,
        schema: ProjectFormSchema,
        onFormSubmit: (values) => {
          // Validasi untuk menolak proyek SubQL
          if (values[ProjectFormKey.deploymentId].startsWith('SubQL')) {
            throw new Error('Pembuatan proyek SubQL tidak diizinkan.');
          }
          // Lanjutkan ke logika lama jika validasi berhasil
          return onAddProject(values);
        },
        items: [
          {
            formKey: ProjectFormKey.deploymentId,
            title: 'Deployment ID',
            placeholder: 'Masukkan ID proyek yang valid (SubQL tidak didukung)',
          },
        ],
      },
    },
  ],
});
