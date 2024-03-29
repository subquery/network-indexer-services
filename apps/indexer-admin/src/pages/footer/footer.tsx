// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useLocation } from 'react-router-dom';

import Icon from 'components/Icon';
import { Text } from 'components/primary';

import { linkConfigs } from './config';
import { Container, ContentContainer, IconsContainer } from './styles';

const Header = () => {
  const location = useLocation();

  if (['/project/', '/account'].includes(location.pathname)) return null;

  return (
    <Container>
      <ContentContainer>
        <Text mw={160} color="white" fw="700" size={30}>
          Follow Us
        </Text>
        <IconsContainer>
          {linkConfigs.map(({ src, url }) => (
            <Icon size={50} key={url} src={src} url={url} />
          ))}
        </IconsContainer>
      </ContentContainer>
      <Text ml={80} mt={5} color="white" fw="400" size={10}>
        SubQuery © 2024
      </Text>
    </Container>
  );
};

export default Header;
