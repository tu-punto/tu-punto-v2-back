# Backend Security Hardening Phase 1

## Objetivo

Reducir la superficie de ataque del backend `tu-punto-v2-back` con cambios incrementales y de bajo riesgo que no alteren los flujos operativos normales. La fase 1 prioriza endurecimiento perimetral, control de abuso, validacion estricta en endpoints criticos y manejo mas seguro de archivos.

## Alcance

Esta fase cubre cuatro entregas:

1. Blindaje de rutas publicas y restricciones de acceso.
2. Rate limiting focalizado en endpoints sensibles.
3. Endurecimiento de uploads y validacion real de archivos.
4. Validacion estricta de entrada en endpoints criticos.

## Fuera de alcance

- No se tocara el modulo de QR usado para impresion.
- Quedan excluidos de esta fase `router.use("/qr", qr)`, `qr/certificate`, `qr/sign` y el flujo de impresion asociado.
- No se hara una migracion masiva de todos los controladores del backend en esta fase.
- No se cambiara la logica de negocio de ventas, productos, reportes o tracking salvo para validar entrada, limitar abuso y bloquear acceso indebido.

## Contexto actual observado

- Hay rutas publicas que deberian ser privadas o mas controladas, incluyendo `POST /user/register`.
- `product` esta montado sin `requireAuth` a nivel de router y mezcla endpoints publicos con endpoints operativos.
- `tracking` es publico y hoy no tiene rate limit.
- Existen endpoints de reportes costosos que pueden ser abusados.
- Los uploads usan `multer.memoryStorage()` y se validan por `mimetype`, lo cual es insuficiente.
- No existe una capa centralizada de validacion de `body`, `params` y `query`.

## Principios de diseno

- Bajo riesgo primero: priorizar cambios que reduzcan exposicion sin cambiar contratos amplios del frontend.
- Endurecimiento incremental: aplicar primero en rutas sensibles y luego expandir.
- Rechazo explicito: validar y bloquear campos inesperados en endpoints seleccionados.
- Compatibilidad operativa: mantener payloads validos actuales y endurecer solo donde se conoce el contrato.
- Observabilidad minima: registrar rechazos relevantes y eventos de abuso sin inundar logs.

## Entrega 1: Blindaje de rutas publicas

### Objetivo

Reducir acceso no autenticado o acceso demasiado amplio a endpoints sensibles.

### Cambios previstos

- Cerrar `POST /user/register` para que solo `admin` o `superadmin` puedan crear usuarios.
- Revisar rutas montadas sin autenticacion global y proteger las operativas que hoy esten expuestas por accidente.
- Mantener `tracking` publico, pero solo con validacion y rate limit, sin exponer mas datos de los necesarios.
- Mantener `public-reports/*` solo si siguen siendo requeridos; si no hay dependencia operativa confirmada, marcarlos para cierre o proteccion posterior.

### Decision especifica ya acordada

- `POST /user/register` dejara de ser publico.
- La creacion de usuarios quedara restringida a usuarios autenticados con rol `admin` o `superadmin`.

### Riesgo de regresion

- Medio para flujos de alta de usuarios si existia algun uso no autenticado fuera del panel interno.
- Bajo para el resto, siempre que se preserve `tracking` publico y no se toque QR.

### Mitigacion

- Confirmar que el frontend interno ya crea usuarios con sesion autenticada.
- No cambiar rutas publicas que el catalogo o flujos externos consuman sin antes identificarlas.

## Entrega 2: Rate limiting focalizado

### Objetivo

Mitigar fuerza bruta, abuso de recursos y saturacion por repeticion.

### Endpoints prioritarios

- `POST /user/login`
- `GET /tracking/:code`
- `POST /tracking/:code/push-subscriptions`
- endpoints de uploads criticos
- endpoints de reportes pesados en `/reports`
- cualquier ruta publica restante fuera del modulo QR

### Estrategia

- Implementar middleware reutilizable de rate limit por IP con configuracion por ruta.
- Para rutas autenticadas costosas, permitir opcionalmente combinar IP + `userId` para mejor granularidad.
- Responder con `429` y mensaje consistente.
- Registrar eventos sospechosos con contexto minimo: ruta, IP, actor autenticado si existe y conteo.

### Politica inicial sugerida

- `login`: agresiva
- `tracking`: moderada
- `push-subscriptions`: moderada
- `uploads`: moderada a agresiva
- `reports`: agresiva por costo de CPU/memoria/IO

### Riesgo de regresion

- Bajo si los limites iniciales son conservadores y mas altos que el uso real.

### Mitigacion

- Empezar con limites permisivos y endurecer luego segun observacion.
- Excluir health checks o trafico interno si existiera.

## Entrega 3: Uploads y archivos seguros

### Objetivo

Reducir riesgo de archivos maliciosos, exceso de memoria y abuso de almacenamiento.

### Cambios previstos

- Validar tipo real del archivo mediante firma/magic bytes en los uploads priorizados.
- Mantener listas explicitas de tipos permitidos por caso de uso.
- Ajustar tamanos maximos por endpoint, evitando limites excesivos donde no sean necesarios.
- Evitar procesar archivos grandes completamente en memoria cuando el caso operativo lo permita.
- Revisar acceso a comprobantes, guias e imagenes privadas y favorecer almacenamiento/acceso controlado.

### Endpoints prioritarios

- `shippingGuide`
- adjuntos de anuncios
- adjuntos de `financeFlux`
- cualquier otro upload operativo con uso frecuente y riesgo alto

### Estrategia tecnica

- Introducir un helper de validacion de archivos reutilizable.
- Diferenciar limites por tipo de recurso en lugar de un limite global.
- Mantener el flujo actual de negocio y el contrato del frontend donde sea posible.
- Si un endpoint requiere seguir usando memoria en esta fase, limitar mejor el tamano y validar firma antes de continuar el proceso.

### Riesgo de regresion

- Medio, porque puede rechazar archivos que antes pasaban con extensiones o `mimetype` inconsistentes.

### Mitigacion

- Aplicar primero en uploads conocidos del frontend.
- Ajustar mensajes de error claros para que el usuario entienda por que se rechazo el archivo.
- No migrar en esta fase el modulo QR ni flujos no relacionados.

## Entrega 4: Validacion estricta en endpoints criticos

### Objetivo

Evitar datos corruptos, campos no permitidos y payloads malformados en rutas de alto impacto.

### Endpoints prioritarios

- `POST /user/login`
- `POST /user/register`
- `POST /user/change-password`
- `PUT /user/:id`
- endpoints principales de `/reports`
- endpoints publicos de `tracking`
- uploads priorizados que reciban metadata por `body`

### Estrategia tecnica

- Introducir una capa de validacion por esquema para `body`, `params` y `query`.
- Rechazar campos inesperados por defecto en los endpoints incluidos en fase 1.
- Normalizar y validar:
  - ObjectIds
  - fechas
  - montos
  - enums y roles
  - arrays esperados
- Separar los campos editables de los campos sensibles para evitar overposting.

### Campos sensibles a proteger

- `role`
- `must_change_password`
- `failed_login_attempts`
- `login_locked_until`
- cualquier campo de auditoria o control de acceso

### Riesgo de regresion

- Medio si el frontend hoy envia campos extra o formatos tolerados implicitamente.

### Mitigacion

- Implementar esquemas solo en endpoints cuyo contrato se pueda inspeccionar rapidamente.
- Probar payloads reales del frontend antes de cerrar el esquema final.
- Empezar por rechazar entradas claramente invalidas y luego endurecer campos opcionales si es necesario.

## Arquitectura propuesta

### Nuevos componentes

- `middlewares/rateLimit.middleware.ts`
  - middleware reusable con presets por endpoint sensible
- `middlewares/validate.middleware.ts`
  - aplica esquemas a `body`, `params` y `query`
- `validation/`
  - esquemas y helpers reutilizables por modulo
- `services/fileValidation.service.ts` o helper equivalente
  - validacion de firma real, tamanos y tipos permitidos

### Integracion

- Los routers aplicaran middlewares especificos antes de llegar al controlador.
- Los controladores conservaran la logica de negocio y recibiran datos ya validados o normalizados.
- Los cambios deben minimizarse en servicios y repositorios salvo donde sea necesario para acceso seguro a archivos.

## Manejo de errores

- `400` para payload invalido, params invalidos, campos inesperados o archivos no permitidos.
- `401` para acceso sin autenticacion.
- `403` para acceso autenticado sin permisos.
- `429` para exceso de intentos.
- Mensajes de error consistentes y cortos, sin filtrar detalles internos.

## Logging y observabilidad

- Registrar:
  - intentos de login bloqueados por rate limit
  - rechazos de payload por validacion en endpoints criticos
  - rechazos de archivo por firma o tamano
  - abusos repetidos en tracking/reportes/uploads
- No loggear contenido sensible como passwords, tokens o archivos completos.

## Plan de pruebas

### Smoke tests funcionales

- login correcto e incorrecto
- alta de usuario por admin/superadmin
- intento de alta de usuario sin auth
- tracking publico valido e invalido
- uploads validos e invalidos por tipo/tamano
- reportes principales con payload valido

### Pruebas de seguridad basicas

- multiples intentos de login hasta `429`
- multiples requests a tracking hasta `429`
- envio de campos extra en `register` y `update user`
- envio de ObjectIds invalidos y fechas invalidas
- intento de subir archivo con extension correcta pero contenido incorrecto

## Orden de implementacion recomendado

1. Restringir `user/register` y proteger rutas operativas expuestas accidentalmente.
2. Introducir rate limiting reusable y aplicarlo a login, tracking, uploads y reports.
3. Endurecer uploads priorizados con validacion real y mejores limites.
4. Agregar validacion por esquema a usuarios, tracking, reports y metadata asociada a uploads.

## Criterios de exito

- Ya no se puede crear usuarios sin autenticacion de `admin` o `superadmin`.
- Los endpoints sensibles responden `429` ante abuso repetido.
- Los uploads priorizados rechazan archivos no validos por contenido real y por tamano.
- Los endpoints criticos rechazan campos inesperados y entradas malformadas.
- Los flujos existentes de tracking, reportes internos, alta de usuarios interna y uploads validos siguen funcionando.

## Riesgos abiertos

- Puede existir frontend o automatizacion que aun use `POST /user/register` sin auth.
- Algunos reportes o formularios pueden depender de payloads mas laxos que los esperados.
- La validacion real de archivos puede revelar usos actuales con archivos mal etiquetados.

## Decision final de fase 1

Se implementara una fase 1 de endurecimiento de seguridad de bajo riesgo, enfocada en borde y endpoints criticos, sin tocar el modulo QR de impresion. La secuencia de trabajo sera perimetro, limite de abuso, uploads y luego validacion estricta.
