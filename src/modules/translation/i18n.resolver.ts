import { ExecutionContext, Injectable } from '@nestjs/common';
import { I18nResolver } from 'nestjs-i18n';

import { Language } from 'src/entities/user.entity';

const SUPPORTED = new Set(Object.values(Language));

function isSupported(lang: unknown): lang is Language {
  return typeof lang === 'string' && SUPPORTED.has(lang as Language);
}

@Injectable()
export class UserLanguageResolver implements I18nResolver {
  resolve(context: ExecutionContext): string | undefined {
    const request = context.switchToHttp().getRequest();

    if (isSupported(request.user?.language)) {
      return request.user.language as Language;
    }

    if (isSupported(request.query?.language)) {
      return request.query.language as Language;
    }

    if (isSupported(request.body?.language)) {
      return request.body.language as Language;
    }

    const header = request.headers?.['accept-language']?.split(',')[0]?.trim();
    if (isSupported(header)) return header;

    return undefined;
  }
}
