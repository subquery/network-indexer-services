// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { IS_PUBLIC_KEY } from './types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private configService: ConfigService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    let request = context.switchToHttp().getRequest();
    const requestType = context.getType<'graphql'>();

    if (requestType === 'graphql') {
      const ctx = GqlExecutionContext.create(context);
      request = ctx.getContext().req;
    }

    console.log(request.headers);
    const [type, token] = request.headers['x-authorization']?.split(' ') ?? [];
    console.log(type, token);
    if (!['Bearer', 'Proxy'].includes(type) || !token) {
      throw new UnauthorizedException();
    }
    try {
      let secret = '';
      if (type === 'Proxy') {
        secret = request.headers['x-proxy-secret'];
      } else {
        secret = await this.configService.getPassword();
      }
      await this.jwtService.verifyAsync(token, {
        secret,
      });
    } catch (err) {
      throw new UnauthorizedException({
        message: err.message,
        statusCode: 401,
      });
    }
    return true;
  }
}
