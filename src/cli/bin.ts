#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { runInit } from './commands/init.js';
import { printHelp } from './help.js';

/**
 * Walking skeleton del entry point CLI de EducAgent.
 *
 * Routing trivial (sin Commander/yargs): tres comandos, parsing manual de argv.
 * Cuando crezca a más de ~5 comandos con flags complejos, evaluar Commander.
 */

function readPackageVersion(): string {
  // bin.ts compilado vive en dist/cli/bin.js → ../../package.json
  // En dev (tsx) vive en src/cli/bin.ts → ../../package.json
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(here, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'init':
      await runInit();
      return 0;
    case '--version':
    case '-v':
      console.log(readPackageVersion());
      return 0;
    case '--help':
    case '-h':
    case undefined:
      printHelp();
      return 0;
    default:
      console.error(`Comando desconocido: ${command}`);
      printHelp();
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('Error inesperado:', err);
    process.exit(2);
  });
