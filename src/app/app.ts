import { Component, inject } from '@angular/core';
import { Http } from './http';

@Component({
  selector: 'app-root',
  template: ` <h1 class="text-3xl font-bold underline">Hello world!</h1> `,
})
export class App {
  http = inject(Http);
}
