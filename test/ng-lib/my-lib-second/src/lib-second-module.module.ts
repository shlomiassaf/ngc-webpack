import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { LibSecondComponentComponent } from './lib-second-component/lib-second-component.component';

@NgModule({
  declarations: [ LibSecondComponentComponent ],
  imports: [ CommonModule ],
  exports: [ LibSecondComponentComponent ]
})
export class MySecondLibraryModule {

}
