import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService, TranslateOptions } from 'nestjs-i18n';

@Injectable()
export class TranslationService {
  constructor(private readonly i18n: I18nService) {}

  t(key: string, options?: TranslateOptions): string {
    return this.i18n.t(key, { lang: I18nContext.current()?.lang, ...options });
  }
}
