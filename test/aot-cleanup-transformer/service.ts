import 'rxjs/add/operator/do';
import { Injectable, InjectionToken } from '@angular/core';

export function NonAngularClassDecorator(value1: string, value2: number) {
  return target => {
    return target;
  }
}

export function NonAngulaParam(value1: string, value2: number) {
  return (target: Object, propertyKey: string | symbol, parameterIndex: number) => { }
}

export function NonAngulaProp(value1: string, value2: number) {
  return (target: Object, propertyKey: string | symbol) => { }
}

export type MyType = Injectable;

@Injectable()
@NonAngularClassDecorator('test', 12)
export class MyServiceService {

  constructor(@NonAngulaParam('test1', 99) public testParam, public myType: MyType, public crazy: 'someValue' | true | MyType) {

  }

  myMethod(): number {
    return 99;
  }

  @NonAngulaProp('test', 0) value: any;


  @NonAngulaProp('test', 0) myDecoratedMethod(): number {
    return 55;
  }
}

export const MyTokenToken = new InjectionToken('My Token');
