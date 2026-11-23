# Plan: paqueterías externas aisladas

1. Extender la configuración de paqueterías con tipo, slug y formato de guía,
   manteniendo compatibilidad para las operativas actuales.
2. Crear una colección, API y controles de autorización exclusivos para pedidos
   externos, sin referencias a los modelos financieros ni operativos existentes.
3. Añadir APIs públicas mínimas para branding por slug y validación de acceso
   de usuario a la empresa externa.
4. Adaptar el formulario administrativo según el tipo y el portal de
   paquetería para mostrar el flujo aislado y branding en ambos tipos.
5. Incorporar la landing de slug y verificar que el enrutamiento interno no se
   vea afectado, además de tipos y construcción.
