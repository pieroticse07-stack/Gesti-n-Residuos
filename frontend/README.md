# Frontend · Gestión de Residuos

Módulo Persona con Angular 22 y Signal Forms, basado en la estructura de Semana 14.

```powershell
npm ci
npm start
```

Abre `http://localhost:4200/personas`. El backend de este proyecto usa el puerto **8000**. Si otro servidor está utilizando ese puerto, detén ese servidor antes de iniciar este proyecto.

Configura la URL de FastAPI en `src/environments/environment.ts` y `environment.development.ts`. Las credenciales de Supabase pertenecen únicamente a `backend/.env`; este frontend no contiene claves de base de datos.

El formulario administra `nombres`, `apellidos`, `dni` y `telefono`. `idPersona` se asigna en PostgreSQL. Incluye listado con búsqueda, consulta individual, registro, edición y eliminación con confirmación. Valida DNI de 8 dígitos, teléfono de 9 y nombres/apellidos obligatorios hasta 100 caracteres. Las consultas iniciales se realizan después de la hidratación del navegador, no durante SSR/prerender.

Si todavía no configuras Supabase, se muestra el mensaje de configuración pendiente enviado por FastAPI. No se muestran registros inventados.

Verificación: `npm test -- --no-watch` y `npm run build`.

## Referencia de Angular CLI

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
