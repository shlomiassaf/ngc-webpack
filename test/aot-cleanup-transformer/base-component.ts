import { ChangeDetectorRef, Component, Host } from '@angular/core';

import { NonAngulaParam } from './service';

@Component({
  selector: 'my-base-cmp',
  template: ``
})
export class MyBaseComponentComponent {
  constructor(@NonAngulaParam('', 2) public sdafef: any,  @Host() public cdr: ChangeDetectorRef) { }
}
