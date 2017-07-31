import * as ts from 'typescript';

export class MockTypeChecker {

  services: ts.LanguageService;

  get program(): ts.Program {
    return this.services.getProgram();
  }

  private files: ts.MapLike<{ version: number }> = {};
  private virtFileSystem: {[name: string]: string } = {};
  private servicesHost: ts.LanguageServiceHost;

  constructor(public options: ts.CompilerOptions, virtFiles?: {[name: string]: string }) {
    if (virtFiles) {
      Object.keys(virtFiles).forEach(fileName => this.addVirtFile(fileName, virtFiles[fileName]));
    }

    this.init();
  }

  hasFile(fileName: string): boolean {
    return this.files.hasOwnProperty(fileName);
  }

  addFile(fileName: string) {
    if (this.files.hasOwnProperty(fileName)) {
      this.files[fileName].version++;
    } else {
      this.files[fileName] = { version: 0 };
    }
  }

  addVirtFile(fileName: string, content: string) {
    this.virtFileSystem[fileName] = content;
    this.addFile(fileName);
  }

  getDiagnostics(fileName: string): ts.Diagnostic[] {
    return this.services.getCompilerOptionsDiagnostics()
      .concat(this.services.getSyntacticDiagnostics(fileName))
      .concat(this.services.getSemanticDiagnostics(fileName));
  }

  getSourceFile(fileName: string): ts.SourceFile {
    return this.program.getSourceFile(fileName);
  }

  private init(): void {
    this.servicesHost = {
      getScriptFileNames: () => Object.keys(this.files),
      getScriptVersion: (fileName) => this.files[fileName] && this.files[fileName].version.toString(),
      getScriptSnapshot: (fileName) => {
        if (!this.servicesHost.fileExists(fileName)) {
          return undefined;
        }

        return ts.ScriptSnapshot.fromString(this.servicesHost.readFile(fileName).toString());
      },
      getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
      getCompilationSettings: () => this.options,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
      fileExists: (fileName: string) => this.virtFileSystem.hasOwnProperty(fileName) || ts.sys.fileExists(fileName),
      readFile: (fileName: string) => this.virtFileSystem.hasOwnProperty(fileName) ? this.virtFileSystem[fileName] : ts.sys.readFile(fileName) ,
      readDirectory: ts.sys.readDirectory,
    };

    this.services = ts.createLanguageService(this.servicesHost, ts.createDocumentRegistry());


  }
}

// export class MockTypeChecker {
//
//   public program: ts.Program;
//
//   private virtFileSystem: {[name: string]: string };
//   private host: ts.CompilerHost;
//
//   constructor(public options: ts.CompilerOptions, virtFiles?: {[name: string]: string }) {
//     this.virtFileSystem = virtFiles
//       ? Object.assign({}, virtFiles)
//       : {}
//     ;
//     this.init();
//   }
//
//   hasFile(fileName: string): boolean {
//     return this.virtFileSystem.hasOwnProperty(fileName);
//   }
//
//   addFile(name: string, content: string) {
//     this.virtFileSystem[name] = content;
//     if (this.program) {
//       this.program = ts.createProgram([name], this.options, this.host, this.program);
//       this.program.emit(this.program.getSourceFile(name));
//     }
//   }
//
//   private init(): void {
//     const _host: ts.CompilerHost = ts.createCompilerHost(this.options);
//     this.host = Object.create(_host, {
//       writeFile: { value: (fileName, content) => {} },
//       getSourceFile: { value: (fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) => {
//         if (this.virtFileSystem.hasOwnProperty(fileName)) {
//           const sourceText = this.virtFileSystem[fileName];
//           return sourceText !== undefined
//             ? ts.createSourceFile(fileName, sourceText, languageVersion)
//             : undefined
//             ;
//         } else {
//           return _host.getSourceFile(fileName, languageVersion, onError);
//         }
//       }},
//       getSourceFileByPath: { value: (fileName: string, path: ts.Path, languageVersion: ts.ScriptTarget, onError?: (message: string) => void) => {
//         return _host.getSourceFileByPath(fileName, path, languageVersion, onError);
//       } },
//       fileExists: { value: (fileName: string) => this.virtFileSystem.hasOwnProperty(fileName) || _host.fileExists(fileName) },
//       readFile: { value: (fileName: string) => this.virtFileSystem.hasOwnProperty(fileName) ? this.virtFileSystem[fileName] : _host.readFile(fileName) }
//     });
//
//     this.program = ts.createProgram(Object.keys(this.virtFileSystem), this.options, this.host);
//   }
// }

