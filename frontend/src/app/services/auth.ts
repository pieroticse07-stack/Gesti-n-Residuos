import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api } from './api';
import { User } from '../interfaces/platform';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  private restoring: Promise<void> | null = null;
  restore(): Promise<void> {
    if (this.ready()) return Promise.resolve();
    return (this.restoring ??= this.api
      .get<User>('/auth/me')
      .then((user) => {
        this.user.set(user);
      })
      .catch(() => {
        this.user.set(null);
      })
      .finally(() => {
        this.ready.set(true);
      }));
  }
  async login(data: unknown, register = false): Promise<void> {
    this.user.set(await this.api.post<User>(register ? '/auth/registro' : '/auth/login', data));
    this.ready.set(true);
  }
  async logout(): Promise<void> {
    await this.api.post('/auth/logout');
    this.user.set(null);
    this.ready.set(true);
  }
}

export const authGuard: CanActivateFn = async (route) => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.restore();
  if (!auth.user()) return router.parseUrl('/ingresar');
  const roles = route.data['roles'] as string[] | undefined;
  return !roles || roles.includes(auth.user()!.rol) ? true : router.parseUrl('/panel');
};
