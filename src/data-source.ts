import { config } from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

config();

const isCompiled = __filename.endsWith('.js');
const ext = isCompiled ? 'js' : 'ts';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [path.join(__dirname, `entities/*.${ext}`)],
  migrations: [path.join(__dirname, `migrations/*.${ext}`)],
});
