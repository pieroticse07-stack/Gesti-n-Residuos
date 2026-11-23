import { RenderMode, ServerRoute } from '@angular/ssr';
// Las vistas autenticadas se resuelven en el navegador; no se consulta Supabase al compilar.
export const serverRoutes: ServerRoute[] = [{ path: '**', renderMode: RenderMode.Client }];
