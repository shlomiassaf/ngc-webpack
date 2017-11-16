import * as minimist from 'minimist';
import { runCli } from './cli';

if (require.main === module) {
  const args: string[] = process.argv.slice(2);
  const parsedArgs = minimist(args);

  const webpackConfig = parsedArgs.webpack;

  if (!webpackConfig) {
    throw new Error('Missing webpack argument');
  }

  delete parsedArgs.webpack;
  args.splice(args.indexOf('--webpack'), 2);

  runCli(webpackConfig, args, parsedArgs)
    .then( parsedDiagnostics => {
      if (parsedDiagnostics.error) {
        console.error(parsedDiagnostics.error);
      }
      process.exit(parsedDiagnostics.exitCode);
    });
}