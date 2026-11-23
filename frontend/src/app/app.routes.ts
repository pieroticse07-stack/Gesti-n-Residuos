import { Routes } from '@angular/router';
import { authGuard } from './services/auth';

const workspace = () => import('./components/workspace/workspace').then((m) => m.Workspace);
const municipal = ['administrador'];
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/landing/landing').then((m) => m.Landing),
    title: 'Huancayo Limpio | Cuidamos nuestra ciudad',
  },
  {
    path: 'ingresar',
    loadComponent: () => import('./components/access/access').then((m) => m.Access),
    title: 'Iniciar sesión | Huancayo Limpio',
  },
  {
    path: 'registro',
    loadComponent: () => import('./components/access/access').then((m) => m.Access),
    data: { register: true },
    title: 'Crear cuenta | Huancayo Limpio',
  },
  {
    path: 'panel',
    loadComponent: workspace,
    canActivate: [authGuard],
    data: { mode: 'panel' },
    title: 'Resumen | Huancayo Limpio',
  },
  {
    path: 'nuevo-reporte',
    loadComponent: () => import('./components/report-new/report-new').then((m) => m.ReportNew),
    canActivate: [authGuard],
    data: { roles: ['ciudadano'] },
    title: 'Nuevo reporte | Huancayo Limpio',
  },
  {
    path: 'reportes',
    loadComponent: workspace,
    canActivate: [authGuard],
    data: { mode: 'reportes' },
    title: 'Reportes | Huancayo Limpio',
  },
  {
    path: 'reportes/:id',
    loadComponent: () =>
      import('./components/report-detail/report-detail').then((m) => m.ReportDetail),
    canActivate: [authGuard],
    title: 'Detalle del reporte | Huancayo Limpio',
  },
  {
    path: 'atenciones',
    loadComponent: workspace,
    canActivate: [authGuard],
    data: { mode: 'atenciones', roles: ['administrador', 'cuadrilla'] },
    title: 'Atenciones | Huancayo Limpio',
  },
  ...['cuadrillas', 'vehiculos', 'cuentas', 'catalogos', 'indicadores'].map((mode) => ({
    path: mode,
    loadComponent: workspace,
    canActivate: [authGuard],
    data: { mode, roles: municipal },
    title: `${mode[0].toUpperCase() + mode.slice(1)} | Huancayo Limpio`,
  })),
  {
    path: 'personas',
    loadComponent: () => import('./components/personas/personas').then((m) => m.Personas),
    canActivate: [authGuard],
    data: { roles: municipal },
    title: 'Personas | Huancayo Limpio',
  },
  { path: '**', redirectTo: '' },
];
