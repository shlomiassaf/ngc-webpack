import { Pipe, PipeTransform } from '@angular/core';

export class GenClass<T> {
  value: T;
}

@Pipe({ name: 'myPipe' })
export class MyPipePipe implements PipeTransform {
  constructor(public genClass: GenClass<string>) {

  }
  transform(value: any) {
    return value;
  }
}