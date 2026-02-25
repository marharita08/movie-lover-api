import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { IS_PUBLIC_KEY } from '../decorators';

import { AccessTokenGuard } from './access-token.guard';

const mockExecutionContext = (): ExecutionContext =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(),
  }) as unknown as ExecutionContext;

describe('AccessTokenGuard', () => {
  let guard: AccessTokenGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccessTokenGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(AccessTokenGuard);
    reflector = module.get(Reflector);
  });

  afterEach(() => jest.clearAllMocks());

  it('should return true if route is public', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = mockExecutionContext();

    const result = guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    expect(result).toBe(true);
  });

  it('should call super.canActivate if route is not public', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = mockExecutionContext();

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(AccessTokenGuard.prototype), 'canActivate')
      .mockReturnValue(true);

    const result = guard.canActivate(context);

    expect(superCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(true);
  });

  it('should call super.canActivate if isPublic is undefined', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = mockExecutionContext();

    const superCanActivate = jest
      .spyOn(Object.getPrototypeOf(AccessTokenGuard.prototype), 'canActivate')
      .mockReturnValue(false);

    const result = guard.canActivate(context);

    expect(superCanActivate).toHaveBeenCalledWith(context);
    expect(result).toBe(false);
  });
});
