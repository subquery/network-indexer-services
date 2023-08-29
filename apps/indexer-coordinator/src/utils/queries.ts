// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { gql } from '@apollo/client/core';
import { DocumentNode } from 'graphql';

// @ts-ignore
export const GET_DEPLOYMENT: DocumentNode = gql`
  query GetDeployment($id: String!) {
    deployment(id: $id) {
      id
      version
      createdTimestamp
      project {
        id
        metadata
        createdTimestamp
        owner
      }
    }
  }
`;

// @ts-ignore
export const GET_INDEXER_PROJECTS: DocumentNode = gql`
  query GetIndexerProjects($indexer: String!) {
    deploymentIndexers(filter: { indexerId: { equalTo: $indexer } }) {
      nodes {
        indexerId
        deploymentId
        status
      }
    }
  }
`;
