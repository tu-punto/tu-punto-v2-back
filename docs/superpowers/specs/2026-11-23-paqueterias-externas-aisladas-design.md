# Paqueterías externas aisladas y landing personalizada

## Objetivo

Ofrecer a otras paqueterías un espacio de registro e historial propio sin que
sus datos intervengan en la operación, rutas, guías, sucursales, ventas,
gastos, multas ni reportes de Tu Punto.

## Tipos de paquetería

La entidad `Paqueteria` tendrá dos tipos:

- `operativa`: conserva el comportamiento actual de Tu Punto, incluidos código
  de guía, tarifa, multa y posibilidad de habilitar rutas.
- `externa`: no recibe código de guía Tu Punto, tarifa, multa ni rutas. Tendrá
  configuración de guía propia y una landing pública de acceso.

El formulario administrativo mostrará solamente los campos aplicables al tipo
seleccionado. Logo y colores permanecen disponibles para ambos tipos.

## Guías de una paquetería externa

Cada externa elige una modalidad:

- `libre`: el usuario registra la guía propia de su empresa sin patrón.
- `tupunto`: exige el patrón definido por Tu Punto para externas.
- `personalizado`: el administrador define el patrón/prefijo que se exigirá.

La guía es obligatoria para el pedido externo y se valida solo dentro del
portal de su paquetería. No se genera ni se reutiliza una guía de Tu Punto.

## Pedidos y aislamiento

Los pedidos externos se almacenarán en una colección propia. Cada registro
incluye guía propia, destinatario, teléfono, descripción y fechas de creación,
actualización y anulación.

No contiene ni referencia sucursal, ruta, estado operativo, precio, pago,
tarifa, multa, guía Tu Punto ni campos financieros. El usuario externo puede
crear, listar, editar o anular únicamente los registros de su paquetería, en
cualquier momento.

Los modelos, API y reportes internos existentes no consultarán esta colección;
por ello estos pedidos no aparecen en ventas, gastos, rutas, finanzas ni
reportes de Tu Punto.

## Landing y acceso

Cada externa activa dispone de un `slug` único y una ruta pública
`/paqueteria/:slug`. La landing consulta únicamente nombre, logo y colores,
presenta su login personalizado y no expone registros ni información interna.

La URL no concede permisos. Tras autenticar, el servidor comprueba que la
cuenta pertenece a esa misma paquetería externa. El portal muestra solo
registro e historial propios. Paqueterías inactivas o slugs inexistentes no
permiten acceso.

## Identidad visual

El logo, color principal y secundario configurados por Tu Punto se aplican al
portal de cualquier paquetería. Para una externa se aplican también al landing
y login. Las pantallas administrativas de Tu Punto conservan su diseño global;
solo muestran el branding como identificador de cada empresa.

## Seguridad y verificación

- Solo administradores de Tu Punto crean, editan, activan/desactivan y asignan
  usuarios a paqueterías externas.
- Se validan slug único, tipo válido y formato de guía escogido.
- Se prueban acceso por URL, aislamiento entre dos externas, CRUD propio,
  inactividad, formatos de guía, branding y ausencia total en módulos internos.
