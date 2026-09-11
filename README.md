# Abbey Road · Portal educativo v2

Portal independiente para Abbey Road – Instituto de Inglés para Niños. No modifica la página institucional anterior.

Esta versión fue reconstruida para evitar los problemas del primer intento:

- No usa variables `VITE_SUPABASE_*`.
- Las claves se leen en tiempo de ejecución mediante funciones de Netlify.
- Cambiar una variable no exige volver a compilar: después de guardarla, recargá la página.
- El Supervisor inicial se crea automáticamente; no hay que crearlo manualmente en Authentication ni editarlo con SQL.
- El registro de cuentas tampoco depende de correos de confirmación.
- Los mensajes de configuración distinguen entre variables faltantes, esquema ausente y claves que no coinciden.
- El build ejecuta directamente `vite build`; no hay scripts Bash ni permisos de archivos que puedan fallar.

## Funciones por rol

### Supervisor

- Crear cuentas, que siempre nacen como alumnos.
- Cambiar un alumno a Profesor o devolverlo a Alumno.
- Editar perfiles, desactivar/reactivar, restablecer claves y eliminar cuentas.
- Administrar grupos, materiales, calificaciones y chats.
- La base impide dejar al portal sin ningún Supervisor activo.

### Profesores

- Crear grupos y elegir alumnos.
- Publicar material de estudio y enlaces.
- Cargar calificaciones y devoluciones.
- Participar y moderar los chats de sus grupos.

### Alumnos

- Ver materiales de sus grupos.
- Ver únicamente sus propias calificaciones.
- Participar en los chats de los grupos a los que pertenecen.

## Instalación limpia recomendada

Para comenzar verdaderamente de cero, creá un proyecto nuevo en Supabase y un sitio nuevo en Netlify. Así no quedan variables, tablas o usuarios de las pruebas anteriores.

### Paso 1 · Preparar Supabase

1. Creá o abrí el proyecto de Supabase.
2. Entrá en **SQL Editor**.
3. Presioná **New query**.
4. Abrí el archivo `supabase/schema.sql` de este paquete, copiá todo y pegalo en la consulta.
5. Presioná **Run**. La última respuesta debe mostrar una fila con `schema_version = 2.0`.

El aviso de “Potential issue detected” puede aparecer porque el script reemplaza políticas y triggers si ya existían. El archivo no contiene `DROP TABLE` ni borra datos. Si estás usando el archivo original de este paquete, podés confirmar **Run query**.

No hace falta crear el usuario Supervisor desde el panel de Authentication.

### Paso 2 · Obtener las tres claves de Supabase

En Supabase abrí **Settings → API Keys** y copiá con el botón de copiar:

1. **Project URL**.
2. **Publishable key** (normalmente comienza con `sb_publishable_`).
3. **Secret key / service_role**. Esta es privada y nunca debe enviarse por chat ni colocarse en archivos públicos.

### Paso 3 · Cargar cuatro variables en Netlify

Abrí **Netlify → Project configuration → Environment variables** y creá exactamente estas variables:

| Key | Value | ¿Marcar secreta? |
| --- | --- | --- |
| `SUPABASE_URL` | Project URL de Supabase | No |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key o service_role del mismo proyecto | Sí |
| `INITIAL_SUPERVISOR_PASSWORD` | `SupeX1234**` | Sí |

Para cada variable seleccioná:

- **All scopes**.
- **Same value for all deploy contexts**.

La clave va en el campo **Value**, nunca en **Key**. Los nombres no llevan `https://`, espacios ni comillas.

### Paso 4 · Publicar el proyecto completo

La opción más estable es subir esta carpeta a un repositorio privado de GitHub e importarlo en Netlify. Netlify detectará `netlify.toml` y usará automáticamente:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js 20

No publiques únicamente la carpeta `dist`: el portal necesita también las funciones de Netlify. Tampoco selecciones Next.js; este proyecto es Vite + React.

### Paso 5 · Primer ingreso

1. Abrí el sitio publicado.
2. El portal verificará las claves, comprobará el esquema y creará automáticamente el Supervisor si todavía no existe.
3. Ingresá con:

   - Usuario: `Supervisor`
   - Contraseña: `SupeX1234**`

4. El portal te pedirá cambiar esa contraseña inicial.
5. Cuando confirmes que el acceso funciona, podés borrar `INITIAL_SUPERVISOR_PASSWORD` de Netlify. Las otras tres variables deben permanecer.

## Qué hacer si aparece una pantalla de configuración

La propia pantalla indicará el error concreto:

- **Faltan variables:** agregá únicamente las que figuren en la lista y recargá.
- **Falta preparar la base:** ejecutá `supabase/schema.sql` completo.
- **La clave pública no coincide:** volvé a copiar la Publishable key del mismo proyecto.
- **La clave privada no coincide:** revisá que URL y Secret/service_role pertenezcan al mismo proyecto.
- **Las funciones no están disponibles:** se publicó solamente `dist` o el host no procesó `netlify/functions`.

No hace falta volver a desplegar para corregir el valor de una variable. Las funciones lo leen al abrir la página.

## Prueba local opcional

Requiere Node.js 20 o superior y Netlify CLI:

```bash
npm install
npx netlify dev
```

Las variables deben estar en un archivo `.env` local basado en `.env.example`. Nunca subas ese archivo ni compartas la clave privada.

Para verificar el paquete antes de subirlo:

```bash
npm run verify
```

## Seguridad y privacidad

- Todas las tablas tienen Row Level Security.
- Los permisos están aplicados en Supabase, no solamente ocultando botones.
- Las contraseñas se guardan únicamente en Supabase Auth.
- La clave privada permanece en las funciones de Netlify y nunca se entrega al navegador.
- Los alumnos no pueden consultar calificaciones ajenas.
- Las cuentas desactivadas dejan de acceder a los datos protegidos.
- No se solicitan correos reales ni datos sensibles de menores.
- La creación de cuentas requiere confirmar autorización adulta.
- Los chats deben ser moderados por la institución y utilizados con autorización de responsables.

## Sobre la carpeta Usuarios

Las carpetas `Usuarios/Alumnos`, `Usuarios/Profesores` y `Usuarios/Supervisores` se incluyen como estructura documental. Un sitio web publicado no puede modificar de forma persistente y segura sus propios archivos fuente.

Los datos reales se almacenan en Supabase. Cada perfil tiene una ruta virtual `storage_path`; al promover a un alumno, cambia automáticamente de `Usuarios/Alumnos/...` a `Usuarios/Profesores/...`.

## Estructura entregada

```text
abbey-road-portal-v2/
├── Usuarios/
│   ├── Alumnos/
│   ├── Profesores/
│   └── Supervisores/
├── netlify/functions/
│   ├── _shared.mjs
│   ├── account.mjs
│   ├── admin-user.mjs
│   ├── public-config.mjs
│   ├── register-user.mjs
│   └── setup-status.mjs
├── public/assets/journey-submarine.svg
├── scripts/verify.mjs
├── src/
├── supabase/schema.sql
├── netlify.toml
└── package.json
```

La identidad visual es una reinterpretación original de una aventura musical británica y submarina. No implica asociación oficial con The Beatles ni con sus titulares de derechos.
