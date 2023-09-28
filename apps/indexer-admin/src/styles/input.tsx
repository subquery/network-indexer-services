// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import styled from 'styled-components';

export const SubqlInput = styled.div`
  .ant-input {
    padding: 12px;
    border-radius: 8px;
    border: none;

    &:focus {
      border: none;
      box-shadow: none;
    }
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }

    &[type='number'] {
      -moz-appearance: textfield;
    }

    &-affix-wrapper {
      padding: 12px;
      border-radius: 8px;
    }

    &-wrapper {
      display: flex;
      border: 1px solid var(--sq-gray300);
      border-radius: 8px;

      .ant-select {
        display: flex;
        align-items: center;
        flex: 1;
        &-selector {
          border-color: transparent !important;
        }

        &-selection-item {
          display: flex;
        }

        &-focused {
          .ant-select-selector.ant-select-selector.ant-select-selector {
            box-shadow: none;
          }
        }
      }
    }

    &-group-addon.ant-input-group-addon.ant-input-group-addon.ant-input-group-addon {
      background: transparent;
      width: 122px;
      border-radius: 8px;
      background: rgba(67, 136, 221, 0.1);
      border: none;
      border-start-start-radius: 8px;
      border-end-start-radius: 8px;
      display: flex;
      margin: 6px;
      flex-shrink: 0;
    }
  }
`;
