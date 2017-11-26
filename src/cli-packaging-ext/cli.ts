

import * as Path from 'path';
import * as minimist from 'minimist';

import { getArgAndDelete } from '../cli/util';
import { createPackageTaskFromConfigFile } from './package-task-from-config-file';

function runConfigFile(webpackConfig: any, configFile: string, args: string[], parsedArgs: minimist.ParsedArgs) {
  const tasks = createPackageTaskFromConfigFile(webpackConfig, Path.resolve(process.cwd(), configFile), { args, parsedArgs });
  const runLoop = () => {
    const b = tasks.shift();
    return b.run().then( parsedDiagnostics => {
      if (!parsedDiagnostics.error && tasks.length > 0) {
        return runLoop();
      } else {
        return parsedDiagnostics;
      }
    });
  };

  runLoop()
    .then( parsedDiagnostics => {
      if (parsedDiagnostics.error) {
        console.error(parsedDiagnostics.error);
      }
      process.exit(parsedDiagnostics.exitCode);
    });
}

if (require.main === module) {
  const args: string[] = process.argv.slice(2);
  const parsedArgs = minimist(args);

  const ngCli = getArgAndDelete('ngCli', args, parsedArgs);
  const libCfg: any = getArgAndDelete('libCfg', args, parsedArgs);
  const webpackConfig = getArgAndDelete('webpack', args, parsedArgs);

  if (!libCfg) {
    throw new Error('Packing is done with library configuration file');
  }
  if (ngCli && webpackConfig) {
    throw new Error('Options "ngCli" and "webpack" are not allowed together.');
  }

  if (ngCli) {
    // p or project is not part of angular cli
    // this will remove the it from argv
    if ('p' in parsedArgs) {
      process.argv.splice(process.argv.indexOf('-p'), 2);
    }
    if ('project' in parsedArgs) {
      process.argv.splice(process.argv.indexOf('--project'), 2);
    }

    require('./ng-cli').getCliConfiguration()
      .then( webpackConfig =>  {
        runConfigFile(webpackConfig, libCfg === true ? '.' : libCfg, args, parsedArgs);
      });
  } else {
    if (!webpackConfig || webpackConfig === true) {
      throw new Error('Missing webpack argument');
    }
    runConfigFile(webpackConfig, libCfg === true ? '.' : libCfg, args, parsedArgs);
  }
}
