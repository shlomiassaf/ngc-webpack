import {
  ChangeDetectorRef, Component, Host, HostBinding, Inject, Optional, Self, ViewChild,
  ViewContainerRef
} from '@angular/core';
import { Http } from '@angular/http';

import { MyTokenToken, NonAngulaProp, NonAngulaParam, NonAngularClassDecorator } from './service';
import { MyDirectiveDirective } from './directive';


export interface MyInterface {
  name: string;
}

@Component({
  selector: 'my-cmp',
  styles: [``],
  template: `<h1 myDirective>{{ 'My Component' | myPipe }} + {{token}}</h1>`
})
export class MyComponentComponent {
  @ViewChild(MyDirectiveDirective) public myDirective: MyDirectiveDirective;

  @HostBinding() @NonAngulaProp('test', 100) hostBinding: string;

  @HostBinding()  @NonAngulaProp('test', 0) myDecoratedMethod(): number {
    return 55;
  }

  constructor(
    @NonAngulaParam('', 2) public sdafef: any,
    @Host() public cdr: ChangeDetectorRef,
    @Self() public vcr: ViewContainerRef,
    @Optional() @Inject(MyTokenToken) public token?: MyInterface,
    @Optional() public http?: Http) {

    console.log(this.myDirective);
  }
}
