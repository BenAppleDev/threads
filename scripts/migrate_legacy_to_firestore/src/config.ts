import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export type Target = 'emulator' | 'prod';

export interface Config {
  pg: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  outputDir: string;
  nymSalt: string;
  target: Target;
  dryRun: boolean;
}

export function loadConfig(overrides?: Partial<Pick<Config, 'target' | 'dryRun' | 'outputDir'>>): Config {
  const target = overrides?.target ?? 'emulator';
  const dryRun = overrides?.dryRun ?? false;
  const outputDir = overrides?.outputDir ?? path.resolve(process.cwd(), 'out');

  return {
    pg: {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'threads_development',
    },
    outputDir,
    nymSalt: process.env.MIGRATION_NYM_SALT || 'dev-salt',
    target,
    dryRun,
  };
}
