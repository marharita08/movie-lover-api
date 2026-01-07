import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest();

    if (!request?.user) {
      return null;
    }

    return data ? request.user?.[data] : request.user;
  },
);
