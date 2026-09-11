# Usuarios

Esta carpeta representa la organización solicitada para los tres niveles del portal.

- `Supervisores/`
- `Profesores/`
- `Alumnos/`

En un sitio publicado, el código no puede crear ni mover archivos de usuario de forma segura. Los perfiles reales se guardan en Supabase. La columna `storage_path` de cada perfil refleja esta misma estructura y cambia automáticamente cuando el Supervisor modifica su rol.

No deben guardarse contraseñas, notas ni datos personales dentro de estas carpetas.
