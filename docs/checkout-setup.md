# VITTA Reset · Mercado Pago y entrega privada

El servidor fija el precio en ARS 49.870 usando `content/site.json`, crea una preferencia Checkout Pro y firma una constancia de compra. El regreso desde Mercado Pago no concede acceso: las funciones consultan el pago y verifican referencia, importe, moneda y modo de producción. Solo el estado `approved` entrega las semanas 2, 3 y 4 y un enlace de descarga firmado de cinco minutos. La descarga vuelve a consultar el estado actual, por lo que un pago pendiente, reembolsado o contracargado no permite recuperar el contenido.

## Configuración de producción

En el proyecto existente de Netlify, configurar como secretos exclusivos de producción y disponibles para Functions:

- `MP_ACCESS_TOKEN`: credencial privada de producción de Mercado Pago.
- `VITTA_ACCESS_SECRET`: secreto aleatorio de al menos 32 caracteres, independiente de Mercado Pago. Conservarlo para que los accesos emitidos sigan funcionando.
- `VITTA_UPLOAD_KEY`: clave aleatoria temporal de al menos 32 caracteres para la carga inicial del material. Se invalida después de una carga completa verificada y debe retirarse de la configuración al finalizar.

`URL` lo proporciona Netlify; `CHECKOUT_SITE_URL` puede fijar el origen HTTPS canónico. `content/site.json` apunta al backend de Netlify para que los botones y la recuperación también funcionen desde la landing de GitHub Pages.

## Material privado

El ZIP original y `weeks.json` se mantienen fuera del repositorio público. En `/programa-configurar.html`, seleccionar ambos archivos y usar la clave temporal. La carga divide el ZIP en bloques de 3 MiB para respetar el límite de solicitudes de Netlify; compara tamaño y SHA-256 y guarda el manifiesto activo solo después de validar ambos materiales. El almacén `vitta-program-private` no tiene ruta de lectura pública. La compra queda deshabilitada mientras falte el manifiesto privado.

Las funciones usan la API moderna de Netlify y descargan el ZIP como flujo, respetando el máximo de 20 MB. El archivo actual tiene 9.586.705 bytes. La clave de carga se invalida al finalizar; el formulario deja de poder modificar el material con esa clave.

## Acceso de compradores

El navegador conserva la constancia firmada antes de abrir Mercado Pago y un pase de acceso después de la aprobación. Cada recuperación exige una nueva consulta al proveedor. La landing elimina del HTML público el contenido de las semanas pagas y lo construye a partir de una respuesta verificada. La entrega no depende de escribirle a Mica; su botón de WhatsApp permanece como acompañamiento.

El regreso con pago aprobado intenta iniciar la descarga una vez y muestra un botón para repetirla. Los pagos pendientes muestran una consulta de estado, sin habilitar contenido ni invitar a pagar otra vez. El acceso se recupera desde el mismo navegador; si se borran sus datos o se cambia de dispositivo, Mica deberá ayudar a recuperar la compra. No se incluye todavía una cuenta de usuario ni envío automático por email.

## Publicación y validación

`npm test` comprueba precios, firmas, estados, recuperación, descarga y carga privada con respuestas simuladas. `npm run build` prepara `dist` y excluye código del servidor, pruebas y archivos ZIP del directorio publicado. Netlify instala `@netlify/blobs` y publica las funciones con Node 22.

Primero desplegar la rama preparada, cargar el material y configurar la credencial privada. Comprobar en el checkout real el producto y el importe sin ejecutar un cobro automático. Solo después publicar los botones de la landing original. Las pruebas locales no sustituyen una prueba de compra real realizada por la titular.

No guardar credenciales reales, CVU, alias ni documentos de identidad en este repositorio.
