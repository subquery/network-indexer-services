// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

// @ts-nocheck
import { useCallback, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Address, Dropdown } from '@subql/components';
import styled from 'styled-components';

import { Separator } from 'components/primary';
import { useController, useIsIndexer, useTokenBalance } from 'hooks/indexerHook';
import { useIsMetaMask, useWeb3 } from 'hooks/web3Hook';
import SubqueryIcon from 'resources/subquery.svg';
import { TOKEN_SYMBOL } from 'utils/web3';

import { Container, LeftContainer, RightContainer } from './styles';

enum TabbarItem {
  account = 'Account',
  network = 'Network',
  projects = 'Projects',
}

const TabBar = styled(NavLink)`
  margin-left: 50px;
  margin-top: 20px;
  color: #1a202c;
  text-decoration: none;
  font-family: Futura;
  font-size: 16px;
  :hover {
    text-decoration: underline;
  }
`;

const OverrideDropdown = styled.div`
  .headerDropdown {
    padding: 15px;
    position: relative;
    height: 54px;

    &::before {
      background: var(--sq-gradient);
      border-radius: 50px;
      bottom: 0;
      content: '';
      left: 0;
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: destination-out;
      mask-composite: exclude;
      padding: 1px;
      position: absolute;
      right: 0;
      top: 0;
    }
  }
`;

const Header = () => {
  const { account, deactivate } = useWeb3();
  const { pathname } = useLocation();
  const isMetaMask = useIsMetaMask();
  const isIndexer = useIsIndexer();
  const controller = useController(account);
  const { tokenBalance } = useTokenBalance(account, pathname);

  const dropdownStyle = { border: 'unset !important', padding: 15, width: 100 };

  const createItem = (key: string, label: string) => ({ key, label });

  const onSelected = (key: string) => {
    if (key === 'disconnect') {
      deactivate();
    }
  };

  const isRootPage = useMemo(() => pathname === '/', [pathname]);
  const accountDetails = useMemo(
    () => [
      createItem('balance', `Token: ${tokenBalance} ${TOKEN_SYMBOL}`),
      createItem('disconnect', 'Disconnect'),
    ],
    [tokenBalance]
  );

  const renderTabbars = useCallback(() => {
    const activeStyle = { fontWeight: 500, color: '#4388dd' };

    return (
      <div>
        <TabBar to="/account" activeStyle={activeStyle}>
          {TabbarItem.account}
        </TabBar>
        <TabBar to="/network" activeStyle={activeStyle}>
          {TabbarItem.network}
        </TabBar>
        {controller && (
          <TabBar to="/projects" activeStyle={activeStyle}>
            {TabbarItem.projects}
          </TabBar>
        )}
      </div>
    );
  }, [controller]);

  const renderAddress = () =>
    isRootPage ? (
      <Address address={account} size="large" />
    ) : (
      <OverrideDropdown>
        <Dropdown
          className="headerDropdown"
          menuitem={accountDetails}
          onSelected={onSelected}
          label=" "
          LeftLabelIcon={<Address address={account} size="large" />}
        />
      </OverrideDropdown>
    );

  return (
    <Container>
      <LeftContainer>
        <img src={SubqueryIcon} alt="subquery" />
        {!isRootPage && isIndexer && renderTabbars()}
      </LeftContainer>
      {isMetaMask && (
        <RightContainer>
          <Separator width={30} color="#f6f9fc" />
          {account && renderAddress()}
        </RightContainer>
      )}
    </Container>
  );
};

export default Header;
