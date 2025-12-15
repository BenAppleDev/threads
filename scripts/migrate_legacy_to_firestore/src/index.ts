import fs from 'fs';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadConfig, Target } from './config';
import { connect, loadLegacyData } from './postgres';
import { transformAll } from './transform';
import { importDocs, initFirestore, readJsonl } from './firestore';
import { validateCounts } from './validate';

async function ensureOutDir(dir: string) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function writeJsonl(filePath: string, docs: unknown[]) {
  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });
  docs.forEach((doc) => {
    stream.write(JSON.stringify(doc));
    stream.write('\n');
  });
  stream.end();
  await new Promise((resolve) => stream.on('finish', resolve));
}

async function runExport(target: Target, outputDir: string) {
  const cfg = loadConfig({ target, outputDir });
  const pool = await connect(cfg);
  const data = await loadLegacyData(pool);
  const docs = transformAll(data, cfg);
  await ensureOutDir(cfg.outputDir);

  await writeJsonl(path.join(cfg.outputDir, 'instances.jsonl'), docs.filter((d) => d.path.split('/').length === 2));
  await writeJsonl(
    path.join(cfg.outputDir, 'rooms.jsonl'),
    docs.filter((d) => d.path.split('/').length === 4 && d.path.split('/')[2] === 'rooms')
  );
  await writeJsonl(
    path.join(cfg.outputDir, 'users.jsonl'),
    docs.filter((d) => d.path.split('/').length === 4 && d.path.split('/')[2] === 'users')
  );
  await writeJsonl(
    path.join(cfg.outputDir, 'memberships.jsonl'),
    docs.filter((d) => d.path.split('/').length === 6 && d.path.split('/')[4] === 'members')
  );
  await writeJsonl(
    path.join(cfg.outputDir, 'messages.jsonl'),
    docs.filter((d) => d.path.split('/').length === 6 && d.path.split('/')[4] === 'messages')
  );

  await pool.end();
  console.log(`Exported ${docs.length} docs to ${cfg.outputDir}`);
}

async function runImport(target: Target, outputDir: string, dryRun: boolean) {
  const cfg = loadConfig({ target, dryRun, outputDir });
  const db = initFirestore(cfg.target);

  const files = ['instances.jsonl', 'rooms.jsonl', 'users.jsonl', 'memberships.jsonl', 'messages.jsonl'];
  for (const file of files) {
    const filePath = path.join(cfg.outputDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Skipping missing file ${filePath}`);
      continue;
    }
    const docs = await readJsonl(filePath);
    console.log(`Importing ${docs.length} docs from ${file}`);
    await importDocs(docs, db, cfg);
  }
}

async function runValidate(target: Target, outputDir: string) {
  const cfg = loadConfig({ target, outputDir });
  const pool = await connect(cfg);
  const db = initFirestore(cfg.target);
  await validateCounts(pool, db);
  await pool.end();
}

yargs(hideBin(process.argv))
  .command(
    'export',
    'Export legacy data to JSONL files',
    (y) =>
      y.option('output', {
        alias: 'o',
        type: 'string',
        default: path.resolve(process.cwd(), 'out'),
        describe: 'Output directory for JSONL files',
      }),
    async (argv) => {
      await runExport((argv.target as Target) || 'emulator', argv.output as string);
    }
  )
  .command(
    'import',
    'Import JSONL files into Firestore',
    (y) =>
      y
        .option('output', {
          alias: 'o',
          type: 'string',
          default: path.resolve(process.cwd(), 'out'),
          describe: 'Directory containing JSONL files',
        })
        .option('target', {
          choices: ['emulator', 'prod'],
          default: 'emulator',
        })
        .option('dry-run', {
          type: 'boolean',
          default: false,
          describe: 'Only log intended writes',
        }),
    async (argv) => {
      await runImport((argv.target as Target) || 'emulator', argv.output as string, (argv['dry-run'] as boolean) || false);
    }
  )
  .command(
    'validate',
    'Validate counts between Postgres and Firestore',
    (y) =>
      y
        .option('target', {
          choices: ['emulator', 'prod'],
          default: 'emulator',
        })
        .option('output', {
          alias: 'o',
          type: 'string',
          default: path.resolve(process.cwd(), 'out'),
          describe: 'Output directory (for parity with export/import)',
        }),
    async (argv) => {
      await runValidate((argv.target as Target) || 'emulator', argv.output as string);
    }
  )
  .option('target', {
    choices: ['emulator', 'prod'],
    default: 'emulator',
    describe: 'Firestore target',
  })
  .demandCommand(1)
  .help().argv;
