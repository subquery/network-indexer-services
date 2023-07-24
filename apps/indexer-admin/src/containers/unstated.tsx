// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { createContext, ReactNode, useContext, useMemo } from 'react';

import Logger from 'utils/logger';

const EMPTY: unique symbol = Symbol(undefined);

export type Props<State = void> = {
  initialState?: State;
  children?: ReactNode;
};

export type Container<V, State = void> = {
  Provider: React.ComponentType<Props<State>>;
  useContainer: () => V;
};

const logger = new Logger();

export function createContainer<V, State = void>(
  useHook: (logger: Logger, initialState?: State) => V,
  options?: { displayName?: string }
): Container<V, State> {
  const Ctx = createContext<V | typeof EMPTY>(EMPTY);
  if (options?.displayName) {
    Ctx.displayName = options.displayName;
  }

  function Provider(props: Props<State>) {
    const { initialState, children } = props;
    const l = useMemo(
      () => (options?.displayName ? logger.getLogger(options?.displayName) : logger),
      []
    );

    const value = useHook(l, initialState);
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  }

  function useContainer(): V {
    const value = useContext(Ctx);

    if (value === EMPTY) {
      throw new Error(
        `Component must be wrapped with <${Ctx.displayName ?? 'Container'}.Provider>`
      );
    }

    return value;
  }

  return { Provider, useContainer };
}
