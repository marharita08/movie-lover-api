import { MessageAuthor } from 'src/entities';

export const messageAuthorToRole = {
  [MessageAuthor.USER]: 'USER',
  [MessageAuthor.ASSISTANT]: 'MODEL',
};
