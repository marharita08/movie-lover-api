import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { IS_PUBLIC_KEY } from '../decorators';

import { AccessTokenGuard } from './access-token.guard';

const mockExecutionContext = (user?: object): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenGuard,
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    }).compile();

    guard = module.get(AccessTokenGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return true if route is public', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = mockExecutionContext();

    expect(guard.canActivate(context)).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should return true if route is not public and request has user', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = mockExecutionContext({ id: 'user-uuid' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException if route is not public and request has no user', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = mockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
