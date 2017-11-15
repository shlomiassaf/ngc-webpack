import '@ngtools/webpack';
const WebpackCompilerHost = require('@ngtools/webpack/src/compiler_host').WebpackCompilerHost;

const desc = Object.getOwnPropertyDescriptor(WebpackCompilerHost.prototype, 'writeFile');
if (typeof desc.get === 'function' && !desc.set) {
  Object.defineProperty(WebpackCompilerHost.prototype, 'writeFile', {
    get: desc.get,
    set: function(wf) { Object.defineProperty(this, 'writeFile', { value: wf }); }
  });
}
