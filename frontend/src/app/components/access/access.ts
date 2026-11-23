import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form,
  FormField,
  FormRoot,
  required,
  pattern,
  minLength,
  maxLength,
} from '@angular/forms/signals';
import { Auth } from '../../services/auth';
import { Api, errorMessage } from '../../services/api';
import { Icon } from '../shared/icon';
import { Row } from '../../interfaces/platform';

@Component({
  selector: 'app-access',
  imports: [RouterLink, FormField, FormRoot, Icon],
  templateUrl: './access.html',
  styleUrl: './access.css',
})
export class Access {
  register = inject(ActivatedRoute).snapshot.data['register'] === true;
  private auth = inject(Auth);
  private api = inject(Api);
  private router = inject(Router);
  error = signal('');
  lookupMessage = signal('');
  looking = signal(false);
  suggestion = signal<Row | null>(null);
  consent = signal(false);
  showPassword = signal(false);
  model = signal({ correo: '', password: '', nombres: '', apellidos: '', dni: '', telefono: '' });
  fields = form(
    this.model,
    (p) => {
      required(p.correo);
      pattern(p.correo, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Introduce un correo válido.' });
      required(p.password);
      minLength(p.password, 10, { message: 'Utiliza al menos 10 caracteres.' });
      maxLength(p.password, 128);
      if (this.register) {
        required(p.nombres);
        pattern(p.nombres, /\S/);
        maxLength(p.nombres, 100);
        required(p.apellidos);
        pattern(p.apellidos, /\S/);
        maxLength(p.apellidos, 100);
        required(p.dni);
        pattern(p.dni, /^[0-9]{8}$/);
        required(p.telefono);
        pattern(p.telefono, /^[0-9]{9}$/);
      }
    },
    { submission: { action: async () => this.submit() } },
  );
  async submit() {
    this.error.set('');
    if (this.register && !this.consent()) {
      this.error.set('Confirma que has revisado tus datos antes de crear la cuenta.');
      return { kind: 'consent', message: 'Confirma tus datos.' };
    }
    const m = this.model();
    try {
      await this.auth.login(
        this.register
          ? {
              correo: m.correo,
              password: m.password,
              persona: {
                nombres: m.nombres,
                apellidos: m.apellidos,
                dni: m.dni,
                telefono: m.telefono,
              },
            }
          : { correo: m.correo, password: m.password },
        this.register,
      );
      await this.router.navigateByUrl('/panel');
    } catch (e) {
      const message = errorMessage(e);
      this.error.set(message);
      return { kind: 'server', message };
    }
    return undefined;
  }
  async lookup() {
    this.suggestion.set(null);
    this.lookupMessage.set('');
    const dni = this.model().dni;
    if (!/^[0-9]{8}$/.test(dni)) {
      this.lookupMessage.set('El DNI debe tener 8 dígitos.');
      return;
    }
    this.looking.set(true);
    try {
      const result = await this.api.post<Row>('/integraciones/dni/consulta', { dni });
      if (this.model().dni === dni) this.suggestion.set(result);
    } catch (e) {
      this.lookupMessage.set(errorMessage(e));
    } finally {
      this.looking.set(false);
    }
  }
  useSuggestion() {
    const s = this.suggestion();
    if (s && s['dni'] === this.model().dni)
      this.model.update((m) => ({ ...m, nombres: s['nombres'], apellidos: s['apellidos'] }));
    this.suggestion.set(null);
  }
}
