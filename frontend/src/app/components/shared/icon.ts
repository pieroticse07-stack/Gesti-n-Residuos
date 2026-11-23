import { Component, input } from '@angular/core';

@Component({
  selector: 'app-icon',
  template: `<svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path [attr.d]="paths[name()] || paths['leaf']" />
  </svg>`,
  styles: [
    `
      :host {
        display: inline-flex;
        width: 1.3rem;
        height: 1.3rem;
        flex-shrink: 0;
      }
      svg {
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class Icon {
  name = input('leaf');
  paths: Record<string, string> = {
    leaf: 'M20 4C10 2 3 7 5 14c2 7 15 5 15-10ZM5 21c0-6 5-10 10-12',
    pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0Z',
    map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3ZM9 3v15M15 6v15',
    plus: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M18 6 6 18',
    search: 'M20 20l-5-5M17 10a7 7 0 1 0-14 0 7 7 0 0 0 14 0Z',
    refresh: 'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
    check: 'm5 12 4 4L19 6',
    home: 'm3 10 9-7 9 7v10H3ZM9 20v-7h6v7',
    grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
    report: 'M6 3h12v18H6ZM9 8h6M9 12h6M9 16h4',
    users:
      'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 4a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-4',
    truck:
      'M2 5h12v12H2ZM14 9h4l4 5v3h-8M7 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0ZM21 19a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z',
    shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6ZM8 12l3 3 5-6',
    chart: 'M4 3v18h17M8 16v-5M13 16V7M18 16V4',
    catalog: 'M3 4h7v7H3ZM14 4h7v7h-7ZM3 15h7v6H3ZM14 15h7v6h-7Z',
    logout: 'M9 3H4v18h5M13 8l5 4-5 4M8 12h13',
    clock: 'M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
    mail: 'M3 5h18v14H3Zm0 0 9 8 9-8',
  };
}
