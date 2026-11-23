import {
  afterNextRender,
  Directive,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  output,
} from '@angular/core';

@Directive({ selector: '[appDialogFocus]' })
export class DialogFocus implements OnDestroy {
  dismiss = output<void>();
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private previous: HTMLElement | null = null;
  private previousOverflow = '';
  constructor() {
    afterNextRender(() => {
      this.previous = document.activeElement as HTMLElement;
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.focusables()[0]?.focus();
    });
  }
  private focusables(): HTMLElement[] {
    return Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]',
      ),
    );
  }
  @HostListener('keydown', ['$event']) key(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss.emit();
    }
    if (event.key !== 'Tab') return;
    const items = this.focusables();
    const first = items[0],
      last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  ngOnDestroy() {
    if (this.previous) {
      document.body.style.overflow = this.previousOverflow;
      this.previous.focus();
    }
  }
}
