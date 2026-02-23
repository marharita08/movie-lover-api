import { ExecutionContext } from '@nestjs/common';

import { GetUser } from './get-user.decorator';

const getParamDecoratorFactory = (
  decorator: (...args: unknown[]) => ParameterDecorator,
) => {
  class TestController {
    test(@decorator() _value: unknown) {}
  }
  const args = Reflect.getMetadata(
    '__routeArguments__',
    TestController,
    'test',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => unknown }
  >;

  return args[Object.keys(args)[0]].factory;
};

const mockContext = (user: unknown) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as unknown as ExecutionContext;

describe('GetUser decorator', () => {
  let factory: (data: string | undefined, ctx: ExecutionContext) => unknown;

  beforeEach(() => {
    factory = getParamDecoratorFactory(GetUser);
  });

  it('should return null if user is not in request', () => {
    const result = factory(undefined, mockContext(null));
    expect(result).toBeNull();
  });

  it('should return full user object if data is not provided', () => {
    const user = { id: 'uuid-1', email: 'test@example.com' };
    const result = factory(undefined, mockContext(user));
    expect(result).toEqual(user);
  });

  it('should return specific field if data is provided', () => {
    const user = { id: 'uuid-1', email: 'test@example.com' };
    const result = factory('email', mockContext(user));
    expect(result).toBe('test@example.com');
  });

  it('should return undefined if requested field does not exist on user', () => {
    const user = { id: 'uuid-1' };
    const result = factory('email', mockContext(user));
    expect(result).toBeUndefined();
  });
});
