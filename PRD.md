# PRD — Sistema web de gestión de residuos sólidos de Huancayo

## 1. Propósito y estado del documento

Este documento define el producto que se desarrollará en las carpetas `frontend` y `backend` de este repositorio. El ámbito inicial es Huancayo, Junín; los límites de atención deberán acordarse con la municipalidad antes del piloto.

El producto permitirá que los ciudadanos comuniquen acumulaciones de residuos y que el administrador municipal revise los reportes, apruebe o rechace su atención, establezca prioridades y coordine las cuadrillas hasta validar la resolución.

**Estado actual:** el repositorio contiene el CRUD de Persona en Angular con Signal Forms, FastAPI y PostgreSQL alojado en Supabase. El login, los reportes, la aprobación municipal, las cuadrillas y las integraciones externas son funciones pendientes. Este PRD no acredita su implementación.

## 2. Problemática

Atender un punto de acumulación de residuos requiere localizarlo, conocer el incidente, determinar su competencia y prioridad, asignar recursos y confirmar el resultado. El proyecto busca organizar esta información y permitir al ciudadano conocer qué ocurrió con su reporte.

Las dificultades específicas del proceso actual se contrastarán con tres entrevistas: un ciudadano, un responsable municipal y un integrante o coordinador de cuadrilla. No se consideran realizadas ni se atribuyen resultados a estas entrevistas.

## 3. Objetivos del producto

- Facilitar reportes con tipo de residuo, descripción y ubicación confirmada.
- Permitir la revisión y aprobación o rechazo municipal con trazabilidad.
- Coordinar prioridades, cuadrillas y vehículos disponibles.
- Conservar el seguimiento de las intervenciones hasta la resolución validada.
- Apoyar el ODS 11 y, de manera complementaria, el ODS 12 mediante información útil para la gestión de residuos. El funcionamiento del software no demuestra por sí solo reducción de contaminación o residuos.

## 4. Usuarios y significado de las entidades

`PERSONA` y `USUARIO_SISTEMA` no representan dos clases diferentes de personas:

- **PERSONA:** datos personales: nombres, apellidos, DNI y teléfono.
- **USUARIO_SISTEMA:** cuenta vinculada a una persona: correo, contraseña almacenada como hash y rol.
- **ROL:** permisos que distinguen al ciudadano, administrador municipal e integrante de cuadrilla.

| Actor | Responsabilidad |
| --- | --- |
| Ciudadano | Crear su cuenta, enviar reportes y consultar únicamente sus reportes y seguimiento. |
| Administrador municipal | Revisar, aprobar o rechazar reportes; priorizar; asignar recursos; validar la resolución; administrar catálogos y cuentas autorizadas. |
| Integrante o coordinador de cuadrilla | Consultar las tareas de su cuadrilla vigente y registrar inicio, observaciones y finalización. |

El registro público creará exclusivamente cuentas de ciudadano. El rol administrador municipal no podrá elegirse en el formulario público. Las cuentas de personal y sus permisos se asignarán por un procedimiento administrativo controlado.

## 5. Alcance

### Incluido

- Login, cierre de sesión y autorización por rol.
- Registro de personas y cuentas ciudadanas.
- Consulta de DNI con ApisPeru como apoyo al formulario.
- Ubicación de incidentes con Google Maps Platform y alternativa manual.
- Reportes ciudadanos y seguimiento propio.
- Revisión, aprobación o rechazo municipal con motivo.
- Catálogos, prioridades, cuadrillas, integrantes y vehículos.
- Asignación y reasignación de recursos con historial.
- Registro de ejecución y validación municipal de la resolución.
- Consultas, mapa operativo e indicadores básicos.

### Fuera del alcance inicial

- Optimización automática de rutas y seguimiento GPS continuo.
- Mediciones automáticas de toneladas recogidas.
- Facturación, pagos y sanciones.
- Integración institucional con OEFA o plataformas municipales existentes.
- Notificaciones por SMS, correo o WhatsApp; el seguimiento inicial se consultará dentro del sistema.
- Fotografías y archivos adjuntos: requieren definir almacenamiento, permisos y conservación antes de incorporarlos.

## 6. Flujo y estados

1. El ciudadano inicia sesión y envía un reporte completo.
2. El reporte queda **pendiente de revisión**, sin recursos asignados.
3. El administrador verifica información y competencia territorial.
4. El administrador **aprueba** o **rechaza**, registrando responsable, fecha y motivo.
5. Si se aprueba, determina prioridad y asigna cuadrilla y vehículo disponibles.
6. La cuadrilla inicia y finaliza su intervención, registrando observaciones.
7. El administrador revisa el resultado y confirma la resolución o programa una nueva intervención.
8. El ciudadano consulta la decisión y el avance de su reporte.

### Dos estados independientes

| Dimensión | Valores | Significado |
| --- | --- | --- |
| Revisión | Pendiente, aprobado, rechazado | Decisión municipal sobre el reporte. |
| Atención | Pendiente, en proceso, resuelto | Avance de la limpieza, aplicable al reporte aprobado. |

Un reporte aprobado puede seguir pendiente de atención. Un rechazo no significa que el incidente haya sido resuelto. Antes de aprobarse, el estado de atención se mostrará como **no aplica**, sin contabilizarlo entre los pendientes de limpieza.

El resultado territorial será pendiente, dentro o fuera del ámbito. Un punto fuera del ámbito no generará una asignación local. Si se revisa una decisión o se reabre un caso, se conservará el motivo y el historial; no se sobrescribirá la decisión anterior.

## 7. Reglas de negocio

1. El DNI y el correo de cuenta serán únicos; una persona tendrá como máximo una cuenta.
2. Solo un ciudadano autenticado podrá enviar reportes vinculados a su cuenta.
3. Cada reporte incluirá tipo de residuo activo, descripción, coordenadas válidas y referencia.
4. El ciudadano confirmará el punto del incidente; no se asumirá que coincide con la ubicación de su dispositivo.
5. Los nuevos reportes estarán pendientes de revisión. Solo el administrador municipal podrá aprobarlos o rechazarlos.
6. Cada decisión de revisión conservará fecha, responsable y motivo. Un reporte rechazado no podrá recibir asignaciones.
7. La asignación requerirá aprobación, validación territorial dentro del ámbito y prioridad definida.
8. Cada establecimiento o cambio de prioridad conservará fecha, responsable y motivo.
9. Solo se asignarán cuadrillas vigentes y vehículos operativos sin fecha de baja.
10. No se confirmarán asignaciones simultáneas incompatibles para una cuadrilla o vehículo. El inicio y fin de vigencia de una asignación deberán permitir comprobar sus intervalos.
11. Las reasignaciones conservarán recursos anteriores, responsable, vigencia y motivo.
12. El inicio de una atención no será anterior a su asignación; la finalización no será anterior al inicio.
13. Una intervención finalizada por la cuadrilla no resolverá automáticamente el reporte: se requiere validación municipal y ausencia de atenciones abiertas.
14. Cada cambio de estado y su historial se confirmarán en una misma transacción.
15. La posible duplicidad se revisará por el administrador. No se eliminarán reportes automáticamente; la relación con un original no admitirá ciclos.
16. Los registros con antecedentes relacionados se desactivarán o darán de baja, conservando su historial.
17. La pertenencia vigente a una cuadrilla determinará el acceso a sus tareas; pertenecer históricamente no otorgará acceso actual.
18. ApisPeru apoyará la captura de datos, pero una consulta de DNI no autenticará ni demostrará la titularidad de una persona.
19. Las consultas externas no guardarán personas ni enviarán reportes automáticamente.
20. Los indicadores distinguirán decisiones de revisión, reportes y atenciones. No se informarán toneladas recogidas a partir de la capacidad de un vehículo.

## 8. Requerimientos funcionales

### RF01. Gestión de personas

El sistema deberá permitir:

- Registrar, consultar y actualizar nombres, apellidos, DNI y teléfono.
- Consultar el DNI mediante ApisPeru y presentar los datos disponibles para confirmación.
- Completar los datos manualmente cuando la consulta no tenga resultado o falle.
- Evitar DNI duplicados y conservar los antecedentes de personas con operaciones relacionadas.

**Aceptación:** la consulta no guarda por sí sola; el teléfono se captura manualmente y un fallo externo no borra el formulario.

### RF02. Cuentas, login y permisos

El sistema deberá permitir:

- Registrar una cuenta ciudadana vinculada a una persona.
- Iniciar y cerrar sesión, y consultar la identidad y permisos de la sesión actual.
- Restringir las pantallas y operaciones según rol y propiedad de los datos.
- Administrar las cuentas del personal mediante acceso municipal autorizado.

**Aceptación:** un ciudadano no puede consultar datos privados ajenos, aprobar reportes ni asignarse un rol administrativo mediante peticiones directas. Al cerrar sesión, su sesión deja de autorizar operaciones.

### RF03. Registro y ubicación de reportes

El sistema deberá permitir:

- Registrar tipo de residuo, descripción y dirección de referencia.
- Buscar una dirección, marcar o ajustar el punto en Google Maps y confirmarlo antes del envío.
- Usar GPS solo con permiso, manteniendo la selección manual si se deniega.
- Ingresar coordenadas y referencia manualmente si falla el servicio cartográfico.
- Mostrar código, fecha y estado pendiente de revisión después del registro.

**Aceptación:** no se enviará un reporte incompleto; si faltan coordenadas válidas se conservarán los datos del formulario durante la sesión para corregirlos.

### RF04. Revisión, aprobación y priorización

El sistema deberá permitir al administrador municipal:

- Consultar y filtrar la bandeja de reportes.
- Registrar la validación territorial y sus observaciones.
- Aprobar o rechazar un reporte con motivo y consultar las decisiones previas.
- Establecer o modificar su prioridad conservando antecedentes.
- Revisar posibles duplicados y relacionarlos con un reporte original.

**Aceptación:** la decisión será visible para el reportante; no podrán asignarse recursos a un reporte rechazado, no aprobado o fuera del ámbito.

### RF05. Gestión de cuadrillas e integrantes

El sistema deberá permitir:

- Registrar, consultar y actualizar cuadrillas.
- Vincular usuarios a una cuadrilla con inicio y fin de pertenencia.
- Consultar integrantes vigentes, disponibilidad y tareas asignadas.
- Dar de baja cuadrillas conservando antecedentes.

**Aceptación:** un integrante solo accede a las tareas autorizadas para su pertenencia vigente.

### RF06. Gestión de vehículos

El sistema deberá permitir:

- Registrar placa, marca, modelo, capacidad en toneladas y estado operativo.
- Consultar, actualizar y dar de baja vehículos.
- Consultar su disponibilidad según sus asignaciones vigentes.

**Aceptación:** no se asigna un vehículo de baja, no operativo o con asignación incompatible.

### RF07. Asignación de atenciones

El sistema deberá permitir:

- Asignar cuadrilla y vehículo disponibles a un reporte aprobado.
- Registrar responsable, fechas y vigencia de la asignación.
- Reasignar recursos con motivo, cerrando la vigencia anterior.
- Consultar el historial de asignaciones.

**Aceptación:** solicitudes concurrentes no generan asignaciones incompatibles y la reasignación conserva los recursos anteriores.

### RF08. Ejecución y resolución

El sistema deberá permitir:

- Mostrar a la cuadrilla ubicación, referencia, descripción y prioridad.
- Registrar inicio, observaciones, impedimentos y finalización.
- Permitir al administrador validar la resolución o solicitar otra intervención.
- Reabrir un reporte con responsable y motivo cuando corresponda.

**Aceptación:** finalizar una intervención no equivale a resolver el reporte sin validación municipal.

### RF09. Seguimiento e historial

El sistema deberá permitir:

- Consultar al ciudadano sus decisiones de revisión y estados de atención.
- Mostrar fechas y observaciones destinadas al ciudadano.
- Consultar al personal autorizado responsables, decisiones e intervenciones.
- Conservar la secuencia histórica sin sobrescribir antecedentes.

**Aceptación:** el estado mostrado coincide con el último cambio persistido y no expone información privada de otros ciudadanos.

### RF10. Catálogos

El sistema deberá permitir:

- Registrar, consultar y actualizar tipos de residuos y prioridades.
- Administrar los estados conforme a las transiciones aprobadas.
- Desactivar opciones manteniendo sus relaciones anteriores.
- Ofrecer únicamente opciones activas en nuevas operaciones.

**Aceptación:** desactivar una opción no modifica los reportes anteriores ni permite borrar su historial. Los estados no podrán configurarse para omitir revisión o validación de cierre.

### RF11. Consultas e indicadores

El sistema deberá permitir:

- Mostrar reportes autorizados en mapa y lista con filtros equivalentes.
- Consultar pendientes de revisión, aprobados y rechazados por separado.
- Consultar reportes aprobados pendientes de limpieza, en proceso y resueltos.
- Consultar carga por cuadrilla y tiempos de atención usando fechas existentes.
- Mostrar periodo, filtros y fecha de actualización.

**Aceptación:** los resultados coinciden con los registros persistidos; un caso sin fecha de cierre no genera un tiempo de resolución ficticio.

## 9. Requerimientos no funcionales

Los umbrales siguientes son objetivos propuestos; deberán verificarse antes de declararlos cumplidos.

| Código | Requisito | Criterio de comprobación |
| --- | --- | --- |
| RNF01 | Usabilidad | En una prueba de tareas anterior al piloto, al menos el 90 % de los participantes completará un reporte sin ayuda en un máximo de 3 minutos. Las tres entrevistas exploratorias no acreditan esta medición. |
| RNF02 | Adaptabilidad | Formularios utilizables a 360, 768 y 1366 píxeles, sin pérdida de controles ni desplazamiento horizontal. |
| RNF03 | Rendimiento | Percentil 95 de consultas internas de hasta 100 registros menor o igual a 2 segundos con 20 usuarios concurrentes; documentar entorno y datos. Medir integraciones por separado. |
| RNF04 | Seguridad | HTTPS en producción, contraseñas con hash robusto, sesiones con expiración e invalidación y permisos comprobados en el servidor. Probar acceso cruzado y escalamiento de privilegios. |
| RNF05 | Privacidad | No mostrar DNI, teléfonos o correos en marcadores públicos ni registrarlos en logs. Token de ApisPeru y clave de geocodificación privados; clave web de mapas restringida a sitios y APIs. |
| RNF06 | Integridad | Transacciones y restricciones de unicidad, referencias y concurrencia; probar fallos intermedios y doble asignación. |
| RNF07 | Fallos externos | Máximo de 8 segundos por consulta de DNI o geocodificación; mensaje y alternativa manual sin pérdida del formulario. Evitar reintentos ilimitados. |
| RNF08 | Accesibilidad | Formularios utilizables con teclado, foco visible, etiquetas y errores asociados; alternativa de lista al mapa. |
| RNF09 | Recuperación | Copia diaria, pérdida máxima objetivo de 24 horas y recuperación en 4 horas, comprobadas mediante restauración de prueba. La configuración depende del servicio contratado. |
| RNF10 | Mantenibilidad y operación | Separación por capas, pruebas pertinentes, configuración documentada sin secretos y revisión por pull request. Registrar duración y resultado de integraciones sin datos personales; establecer cuotas y alertas de consumo. |

## 10. Datos y compatibilidad con Supabase

### Persona ya existente

La tabla `public."Persona"` ya fue creada mediante `backend/src/backend/migrations/001_persona.sql` y deberá conservarse:

| Columna | Definición existente |
| --- | --- |
| idPersona | bigint, identidad autogenerada y clave primaria |
| nombres | varchar(100), obligatorio y no vacío |
| apellidos | varchar(100), obligatorio y no vacío |
| dni | varchar(8), obligatorio, único y de ocho dígitos |
| telefono | varchar(9), obligatorio y de nueve dígitos |

No eliminar ni recrear esta tabla para desarrollar los módulos nuevos. Las migraciones deberán preservar datos e identificadores. El borrado físico actual se limitará a personas sin vínculos cuando existan cuentas y reportes relacionados.

### Entidades del sistema completo

- PERSONA, USUARIO_SISTEMA y ROL: identidad, cuentas y permisos.
- REPORTE_INCIDENCIA, TIPO_RESIDUO, PRIORIDAD y ESTADO_REPORTE: incidente, clasificación y avance de atención.
- CUADRILLA, PERTENENCIA_CUADRILLA y VEHICULO_RECOLECTOR: personal y recursos.
- ATENCION_LIMPIEZA e HISTORIAL_ASIGNACION: intervenciones y asignaciones con vigencia.
- HISTORIAL_ESTADO_REPORTE e HISTORIAL_PRIORIDAD: cambios de atención y prioridad.
- HISTORIAL_REVISION_REPORTE: decisiones de aprobación o rechazo con reporte, resultado, responsable, fecha y motivo.

La revisión municipal es una ampliación respecto al diagrama previo y deberá incorporarse al siguiente modelo lógico. REPORTE_INCIDENCIA necesitará identificar su revisión actual, validación territorial y posible reporte original. No mezclar la decisión de aprobación con ESTADO_REPORTE, reservado al avance de atención.

Los catálogos requerirán una condición de actividad. El historial de asignaciones deberá conservar inicio y fin de vigencia para comprobar disponibilidad. Los nombres definitivos, tipos, índices y restricciones de las entidades nuevas se aprobarán al preparar sus migraciones; esta lista no significa que ya existan en Supabase.

## 11. Arquitectura e integraciones

- **Frontend:** Angular y Signal Forms; componentes, interfaces y servicios HTTP. Sin credenciales SQL ni tokens privados.
- **Backend:** FastAPI con `apis`, `schemas`, `services` y `repositories`; validación y autorización en servidor y SQL parametrizado mediante psycopg.
- **Persistencia:** PostgreSQL alojado en Supabase, accedido por el backend mediante conexión privada. El uso de Supabase no implica que Supabase Auth esté implementado.
- **ApisPeru:** consulta de DNI a través del backend con token privado. Adaptar los datos confirmados a nombres y apellidos existentes; teléfono manual. Implementar conforme al contrato vigente del proveedor, sin prometer disponibilidad de todos los DNI.
- **Google Maps Platform:** mapa interactivo en el navegador y geocodificación controlada desde el backend. La ubicación inicial del mapa en Huancayo no valida jurisdicción; se necesita un ámbito aprobado. GPS opcional y sin rastreo continuo.

Antes de activar proveedores reales deberán configurarse cuentas, claves, restricciones, cuotas y condiciones de facturación. Este documento no autoriza contratar planes ni activa servicios externos.

## 12. Pantallas previstas

1. Portada informativa pública.
2. Registro ciudadano y login.
3. Nuevo reporte con formulario y mapa.
4. Mis reportes, decisión municipal y detalle de seguimiento.
5. Bandeja municipal de revisión y aprobación o rechazo.
6. Mapa operativo, clasificación y prioridades.
7. Gestión de cuadrillas, integrantes y vehículos.
8. Asignaciones y su historial.
9. Tareas de cuadrilla y registro de ejecución.
10. Validación municipal del cierre.
11. Catálogos, cuentas autorizadas e indicadores.

## 13. Plan de desarrollo y aceptación

| Incremento | Entrega | Condición mínima |
| --- | --- | --- |
| 1 | Modelo lógico y migraciones incrementales | Conservar Persona; separar revisión y atención; definir vigencias e historiales. |
| 2 | Login y permisos | Registro solo ciudadano; cuenta municipal provisionada de forma controlada; autorización probada en servidor. |
| 3 | Reporte ciudadano e integraciones | Datos completos y ubicación confirmada; errores externos con alternativa manual. |
| 4 | Revisión municipal | Aprobación o rechazo con motivo e historial, visibles al reportante. |
| 5 | Recursos y atención | Asignación sin incompatibilidades, ejecución de cuadrilla y resolución validada. |
| 6 | Seguimiento, indicadores y piloto | Historial íntegro, conteos correctos, pruebas de calidad y evaluación con usuarios. |

Cada incremento se desarrollará en una rama de trabajo y se integrará mediante pull request después de revisar sus cambios. Crear este PRD en `main` no implementa ninguno de estos incrementos.

### Escenario completo de aceptación

Un ciudadano crea su cuenta, inicia sesión y registra un punto de acumulación de residuos. El administrador revisa el caso, valida su competencia y lo aprueba con motivo. Después establece prioridad y asigna recursos disponibles. La cuadrilla registra inicio y finalización, y el administrador confirma la resolución. El ciudadano consulta la secuencia completa. Un reporte rechazado muestra su motivo y no permite iniciar una atención.

### Verificación

- Pruebas de contrato HTTP, validación, permisos, propiedad de reportes y transiciones.
- Pruebas de interfaz de login, formularios, decisiones y seguimiento.
- Pruebas de integridad y concurrencia en una base de pruebas.
- Integraciones externas simuladas en pruebas automatizadas y comprobaciones reales controladas.
- Tres entrevistas pendientes para contrastar necesidades; pruebas de tareas y rendimiento separadas de esas entrevistas.

## 14. Decisiones pendientes antes del piloto

- Acordar el ámbito territorial y los criterios municipales de prioridad, aprobación y rechazo.
- Elegir y documentar el mecanismo de sesión, su duración y recuperación de acceso.
- Definir el procedimiento de creación de la primera cuenta municipal y administración de roles.
- Establecer la visibilidad de observaciones internas y públicas.
- Validar intervalos de asignación, política de reapertura y revisión de decisiones.
- Aprobar las migraciones nuevas y las condiciones de operación de ApisPeru y Google Maps.
