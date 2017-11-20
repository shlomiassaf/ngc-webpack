import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { LibServiceService } from './lib-service.service';
import { LibComponentComponent } from './lib-component/lib-component.component';

@NgModule({
  declarations: [
    LibComponentComponent
  ],
  imports: [ // import Angular's modules
    CommonModule,
    FormsModule
  ],
  exports: [ LibComponentComponent ]
})
export class MyLibraryModule {

  static fromRoot(): ModuleWithProviders {
    return {
      ngModule: MyLibraryModule,
      providers: [
        LibServiceService
      ]
    }
  }
}

