import { Directive, ChangeDetectorRef } from '@angular/core';
import { Http } from "@angular/http";


@Directive({
  selector: '[my-directive]'
})
export class MyDirectiveDirective {
  constructor(public cdr: ChangeDetectorRef, public http: Http) { }
}
