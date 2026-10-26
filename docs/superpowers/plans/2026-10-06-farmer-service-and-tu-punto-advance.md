# Plan técnico: granjero y Adelanto a Tu Punto

1. Extender los contratos Mongo de usuario, pedido, venta y cierre sin migrar ni reinterpretar datos existentes. Añadir el rol `farmer`, sucursal obligatoria, vendedores autorizados y campos separados para los subtotales del adelanto.
2. Crear servicios y repositorios idempotentes para adelantos a Tu Punto, reglas de rango y liquidaciones de granjero. Registrar reversiones como ajustes cuando el cierre del día ya exista.
3. Validar en servidor las operaciones de granjero: identidad autenticada, sucursal, vendedor autorizado, adelanto mayor a cero y menor o igual al total, desglose exacto efectivo/QR y regla de precio única.
4. Integrar los nuevos registros con el cálculo y persistencia del cierre para mostrar el rubro separado sin duplicar efectivo/QR ni cambiar cierres previos.
5. Aplicar los importes de la regla en la entrega: instantánea por línea, ajuste adicional a utilidad de vendedor, saldo del granjero y porción para la empresa. Añadir aprobación administrativa y comprobantes/pagos pendientes.
6. Exponer endpoints restringidos para administrar autorizaciones, reglas, perfil/historial de granjero y liquidaciones.
7. Actualizar el frontend: creación/edición de usuarios, guardas y navegación del granjero, carrito limitado, modal de adelanto obligatorio, perfil, gestión empresarial y cierre de caja.
8. Construir y verificar regresiones de roles, adelantos, cancelaciones, retiro, cierres, reglas inexistentes, autorizaciones y liquidaciones.
