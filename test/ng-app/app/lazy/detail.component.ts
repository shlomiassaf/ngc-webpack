import { Component } from '@angular/core';
/*
 * We're loading this component asynchronously
 * We are using some magic with es6-promise-loader that will wrap the module with a Promise
 * see https://github.com/gdi2290/es6-promise-loader for more info
 */

console.log('`Detail` component loaded asynchronously');

@Component({
  selector: 'detail',
  styleUrls: [ 'detail.component.scss' ],
  templateUrl: 'detail.component.html'
})
export class DetailComponent {
  constructor() {

  }

  ngOnInit() {
    console.log('hello `Detail` component');
  }

}
