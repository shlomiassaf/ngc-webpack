import { Component, SkipSelf, ViewContainerRef, Optional } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'base-about',
  template: ``
})
export class BaseAboutComponent {
  constructor(public route: ActivatedRoute) {

  }
}

@Component({
  selector: 'about',
  styles: [`
  `],
  template: `
    <h1>About</h1>
    <div>
      For hot module reloading run
      <pre>npm run start:hmr</pre>
    </div>
    <div>
      <h3>
        patrick@AngularClass.com
      </h3>
    </div>
    <pre>this.localState = {{ localState | json }}</pre>
  `
})
export class AboutComponent extends BaseAboutComponent {
  localState: any;
  constructor(route: ActivatedRoute, public vcRef: ViewContainerRef) {
    super(route);
  }

  ngOnInit() {
    this.route
      .data
      .subscribe((data: any) => {
        // your resolved data from route
        this.localState = data.yourData;
      });

    console.log('hello `About` component');
    console.log(this.vcRef);

    // static data that is bundled
    // var mockData = require('assets/mock-data/mock-data.json');
    // console.log('mockData', mockData);
    // if you're working with mock data you can also use http.get('assets/mock-data/mock-data.json')
    this.asyncDataWithWebpack();
  }
  asyncDataWithWebpack() {
  }

}
