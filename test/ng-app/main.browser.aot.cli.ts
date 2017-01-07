/*
 * Angular bootstraping
 */
import { platformBrowser } from '@angular/platform-browser';

/*
 * App Module
 * our top level module that holds all of our components
 */
import { AppModuleNgFactory } from '../../dist/test/codegen_cli/test/ng-app/app/app.module.ngfactory';

/*
 * Bootstrap our Angular app with a top level NgModule
 */
export function main(): Promise<any> {
  return platformBrowser()
    .bootstrapModuleFactory(AppModuleNgFactory)
    .catch(err => console.error(err));
}

export function bootstrapDomReady() {
  document.addEventListener('DOMContentLoaded', main);
}

bootstrapDomReady();
