import { I18nLoader, I18nTranslation } from 'nestjs-i18n';

import { en } from 'src/const/translations/en';
import { uk } from 'src/const/translations/uk';
import { Language } from 'src/entities/user.entity';

export class TsLoader extends I18nLoader {
  async languages(): Promise<string[]> {
    return Object.values(Language);
  }

  async load(): Promise<I18nTranslation> {
    return {
      [Language.ENGLISH]: en,
      [Language.UKRAINIAN]: uk,
    } as unknown as I18nTranslation;
  }
}
