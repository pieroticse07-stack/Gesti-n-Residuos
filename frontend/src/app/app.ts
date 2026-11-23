import { afterNextRender, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './services/auth';
import { errorMessage } from './services/api';
import { Icon } from './components/shared/icon';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(Auth);
  private router = inject(Router);
  error = signal('');
  closing = signal(false);
  constructor() {
    afterNextRender(() => void this.auth.restore());
  }
  get isPublic() {
    return ['/', '/ingresar', '/registro'].includes(this.router.url.split('?')[0]);
  }
  get initials() {
    const u = this.auth.user();
    return u ? u.nombres[0] + u.apellidos[0] : '';
  }
  async logout() {
    this.closing.set(true);
    this.error.set('');
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.closing.set(false);
    }
  }
}
