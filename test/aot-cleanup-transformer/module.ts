import { NgModule, Inject } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MyComponentComponent } from './component';
import { MyDirectiveDirective } from './directive';
import { MyPipePipe } from './pipe';
import { MyServiceService, MyTokenToken } from './service';

export class JustASimpleClass {
  constructor(public value: MyServiceService) {}
}

/**
 * `AppModule` is the main entry point into Angular2's bootstraping process
 */
@NgModule({
  bootstrap: [ MyComponentComponent ],
  declarations: [
    MyDirectiveDirective,
    MyPipePipe
  ],
  imports: [
    BrowserModule
  ],
  providers: [
    MyServiceService,
    { provide: MyTokenToken, useValue: 99 }
  ]
})
export class AppModule {
  public justASimpleClass: JustASimpleClass;
  constructor(public myService: MyServiceService, @Inject(MyTokenToken) public token: MyPipePipe) {
    this.myService.myMethod();
    this.justASimpleClass = new JustASimpleClass(myService);
  }
}

// tree shaking stuff, force
if (1 + 1 === 3) {
  console.log(MyComponentComponent, MyDirectiveDirective);
}
