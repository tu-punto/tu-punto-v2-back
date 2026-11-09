# Plan: paqueterías externas aisladas

## Principio de compatibilidad

No se migran ni se reinterpretan pedidos internos existentes. Sus roles, sucursales, cálculos, acciones de impresión/WhatsApp y guías `-0`/`-1` conservan el comportamiento actual. Toda lógica nueva se activa únicamente cuando un pedido posee una paquetería propietaria.

## 1. Modelo, rol y autenticación (backend)

**Archivos principales:** `src/constants/roles.ts`, `src/entities/IUser.ts`, `src/entities/implements/UserSchema.ts`, nuevo esquema/repositorio/servicio de paquetería, `src/middlewares/auth.middleware.ts`.

- Añadir `paqueteria` a los roles permitidos y asociar opcionalmente el usuario a una paquetería.
- Crear la entidad con identidad visual, estado, código numérico de guía desde `2`, tarifa fija, periodicidad/monto de multa y rutas habilitadas.
- Añadir índices únicos para el código de guía y validaciones de importes no negativos e intervalo mayor a cero.
- Cargar el identificador de paquetería del usuario autenticado y crear guardas reutilizables de pertenencia.

## 2. Administración interna y rutas

**Archivos principales:** nuevas rutas/controlador/servicio de paqueterías, rutas de usuario y de rutas de entrega.

- Exponer CRUD administrativo solo para Tu Punto: empresa, marca, tarifa, multa, usuarios y rutas.
- Mantener la entidad de paquetería separada de `Sucursal`; ampliar las opciones de ruta con puntos tipados para que se distingan visual y funcionalmente.
- Validar en servidor que una paquetería solo use sus rutas habilitadas.

## 3. Pedidos externos y cobros

**Archivos principales:** `src/entities/IVentaExterna.ts`, `src/entities/implements/VentaExternaSchema.ts`, `src/services/external.service.ts`, `src/repositories/external.repository.ts`, `src/controllers/external.controller.ts`, `src/routes/external.routes.ts`.

- Agregar referencia a paquetería y snapshot de tarifa/regla de multa a `IVentaExterna` y su esquema.
- Crear endpoints específicos de portal; no reutilizar endpoints administrativos sin filtro de propiedad.
- Al crear un pedido de paquetería, ignorar importes de tarifa del cliente y calcularlos desde su configuración; conservar el reparto pagador-paquetaría/comprador/mixto validado en servidor.
- Limitar lista, detalle, edición y anulación a pedidos de la paquetería autenticada y únicamente en `En Espera`.
- Dejar sin cambios los caminos actuales de ventas externas de Tu Punto cuando no exista `paqueteria_id`.

## 4. Multa y estados

**Archivos principales:** `src/services/external.service.ts`, utilidades de estado/multa existentes y pruebas asociadas.

- Al transicionar a `Listo para recoger`, fijar la fecha de inicio de multa para pedidos de paquetería.
- Calcular períodos completos de X días contra el snapshot y sumar Y por período al saldo del comprador.
- Detener el cálculo para recogido, entregado o anulado; no modificar el régimen de multa existente para pedidos internos.

## 5. Numeración de guías

**Archivos principales:** `src/services/orderGuide.service.ts`, consumidores y pruebas de guía.

- Mantener la secuencia global y su expansión `AA` → `ZZ` → `AAA` sin cambios.
- Preservar el sufijo binario actual para pedidos sin paquetería.
- Para pedidos de paquetería, usar el código numérico configurado de la empresa como último segmento, desde `-2`.
- Asegurar la unicidad completa de `numero_guia` y no modificar guías históricas.

## 6. Portal y administración (frontend)

**Archivos principales:** `src/utils/role.ts`, `src/routes/protectedRoutes.tsx`, `src/constants/menu.ts`, `src/utils/navigationMenu.ts`, nuevos API/modelos/páginas de Paqueterías y PortalPaquetería.

- Añadir la pantalla interna para administrar paqueterías y sus rutas/usuarios.
- Añadir rutas protegidas del portal con una navegación mínima: historial y crear paquete.
- Aplicar logo y variables de color devueltas por la paquetería después de autenticar.
- Construir formulario y detalle sin importación, impresión, QR o WhatsApp; mostrar importes derivados como solo lectura.
- Implementar estados de carga, vacío, error, foco y restricciones visuales consistentes con Ant Design existente.

## 7. Verificación y regresión

- Pruebas unitarias de asignación de guías internas y de paquetería, especialmente el salto `ZZ` → `AAA`.
- Pruebas de API: aislamiento entre dos paqueterías, rutas prohibidas, cálculo/snapshot, multa, edición/anulación y denegación de impresión/WhatsApp.
- Pruebas de interfaz para visibilidad de menú/rutas por rol y ausencia de acciones restringidas.
- Ejecutar `npm run build` en backend y `npm run build`/`npm run lint` en frontend. Ejecutar las pruebas existentes relevantes y corregir cualquier regresión antes de entregar.
