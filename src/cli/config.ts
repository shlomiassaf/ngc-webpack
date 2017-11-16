import * as ts from 'typescript';
import { CompilerOptions, ParsedConfiguration, readConfiguration, EmitFlags } from '@angular/compiler-cli' ;
import { ParsedArgs } from 'minimist';

export interface NgcParsedConfiguration extends ParsedConfiguration { watch?: boolean; }

export function readNgcCommandLineAndConfiguration(args: any,
                                                   parsedArgs?: ParsedArgs): NgcParsedConfiguration {
  const options: CompilerOptions = {};
  parsedArgs = parsedArgs || require('minimist')(args);

  if (parsedArgs.i18nFile) options.i18nInFile = parsedArgs.i18nFile;
  if (parsedArgs.i18nFormat) options.i18nInFormat = parsedArgs.i18nFormat;
  if (parsedArgs.locale) options.i18nInLocale = parsedArgs.locale;
  const mt = parsedArgs.missingTranslation;
  if (mt === 'error' || mt === 'warning' || mt === 'ignore') {
    options.i18nInMissingTranslations = mt;
  }
  const config = readCommandLineAndConfiguration(
    args,
    options,
    ['i18nFile', 'i18nFormat', 'locale', 'missingTranslation', 'watch']
  );

  const watch = parsedArgs.w || parsedArgs.watch;
  return {...config, watch: !!watch};
}


export function readCommandLineAndConfiguration(args: string[],
                                                existingOptions: CompilerOptions = {},
                                                ngCmdLineOptions: string[] = []): ParsedConfiguration {
  let cmdConfig = ts.parseCommandLine(args);
  const project = cmdConfig.options.project || '.';
  const cmdErrors = cmdConfig.errors.filter(e => {
    if (typeof e.messageText === 'string') {
      const msg = e.messageText;
      return !ngCmdLineOptions.some(o => msg.indexOf(o) >= 0);
    }
    return true;
  });
  if (cmdErrors.length) {
    return {
      project,
      rootNames: [],
      options: cmdConfig.options,
      errors: cmdErrors,
      emitFlags: EmitFlags.Default
    };
  }
  const config = readConfiguration(project, cmdConfig.options);
  const options = {...config.options, ...existingOptions};
  if (options.locale) {
    options.i18nInLocale = options.locale;
  }
  return {
    project,
    rootNames: config.rootNames,
    options,
    errors: config.errors,
    emitFlags: config.emitFlags
  };
}
