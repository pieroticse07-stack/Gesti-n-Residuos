import { Routes } from '@angular/router';
import { Personas } from './components/personas/personas';

export const routes: Routes = [
  { path: '', redirectTo: 'personas', pathMatch: 'full' },
  { path: 'personas', component: Personas, title: 'Personas | Gestión de Residuos' },
  { path: '**', redirectTo: 'personas' },
];
