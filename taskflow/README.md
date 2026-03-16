# TaskFlow Pro — Guía de Deploy

Tiempo estimado: **15-20 minutos**. Todo gratis.

---

## Paso 1 — Crear cuenta en GitHub
1. Ve a https://github.com y crea una cuenta (si no tienes)
2. Crea un nuevo repositorio llamado `taskflow-pro` (público o privado, ambos funcionan)
3. Sube los archivos de esta carpeta al repositorio

   **Opción fácil (sin terminal):**
   - En tu repositorio, haz clic en "uploading an existing file"
   - Arrastra y suelta todos los archivos y carpetas
   - Haz clic en "Commit changes"

---

## Paso 2 — Crear proyecto en Supabase
1. Ve a https://supabase.com y crea una cuenta con tu email o Google
2. Haz clic en "New project"
3. Elige un nombre: `taskflow-pro`
4. Crea una contraseña para la base de datos (guárdala)
5. Elige la región más cercana a México: **South America (São Paulo)** o **US East**
6. Espera ~2 minutos a que se cree el proyecto

### Crear las tablas
7. En el panel de Supabase, ve a **SQL Editor** (ícono de base de datos en la barra lateral)
8. Haz clic en **"New query"**
9. Abre el archivo `supabase-schema.sql` de esta carpeta
10. Copia todo el contenido y pégalo en el editor
11. Haz clic en **"Run"** (o Ctrl+Enter)
12. Deberías ver "Success. No rows returned"

### Obtener las credenciales
13. Ve a **Settings** (ícono de engranaje) → **API**
14. Copia los dos valores:
    - **Project URL**: algo como `https://abcxyzabc.supabase.co`
    - **anon public key**: empieza con `eyJhbGciOiJIUzI1NiIsIn...`

---

## Paso 3 — Configurar las credenciales
1. Abre el archivo `js/config.js`
2. Reemplaza los valores:

```js
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';    // Tu Project URL
const SUPABASE_ANON_KEY = 'eyJhbGci...';                   // Tu anon public key
const ANTHROPIC_API_KEY = 'sk-ant-api03-...';              // (Opcional, para Junta con IA)
```

3. Guarda el archivo y vuelve a subirlo a GitHub (o edítalo directamente en GitHub)

> **Nota sobre la API de Anthropic:** Ve a https://console.anthropic.com, crea una cuenta,
> y en "API Keys" genera una nueva clave. La función de Junta con IA la necesita.
> Si no la configuras, la Junta funcionará con análisis local básico.

---

## Paso 4 — Deploy en Netlify
1. Ve a https://netlify.com y crea una cuenta (puedes usar tu cuenta de GitHub)
2. Haz clic en **"Add new site"** → **"Import an existing project"**
3. Elige **GitHub** y autoriza a Netlify
4. Busca y selecciona tu repositorio `taskflow-pro`
5. En la configuración de build:
   - **Build command**: (déjalo vacío)
   - **Publish directory**: `.` (un punto)
6. Haz clic en **"Deploy site"**
7. En ~30 segundos tu sitio estará en vivo con una URL tipo:
   `https://amazing-name-123.netlify.app`

### Personalizar el dominio
8. En Netlify, ve a **Site settings** → **Domain management**
9. Haz clic en **"Options"** junto al dominio generado → **"Edit site name"**
10. Cambia a algo como `taskflow-tuapellido.netlify.app`

---

## ✅ ¡Listo!

Tu app estará disponible en `https://tu-nombre.netlify.app`

**Actualizaciones futuras:**
- Edita los archivos en GitHub → Netlify hace deploy automático en ~30 segundos

---

## Estructura de archivos
```
taskflow/
├── index.html          # Aplicación principal
├── manifest.json       # Configuración PWA
├── netlify.toml        # Configuración de Netlify
├── supabase-schema.sql # Esquema de base de datos
├── css/
│   └── style.css       # Todos los estilos
└── js/
    ├── config.js       # ⚠️  TUS CREDENCIALES VAN AQUÍ
    ├── db.js           # Capa de base de datos (Supabase)
    └── app.js          # Lógica principal de la app
```

---

## Preguntas frecuentes

**¿Es seguro poner mis credenciales en config.js?**
Para uso personal sin auth, la `anon key` de Supabase está diseñada para ser pública.
Las políticas RLS que configuramos en el SQL controlan qué puede hacer. No compartas
tu `service_role` key (esa sí es privada).

**¿Cuánto cuesta?**
- Supabase: Gratis hasta 500MB de base de datos y 2 proyectos activos
- Netlify: Gratis hasta 100GB de ancho de banda / mes
- Para uso personal: $0/mes indefinidamente

**¿Puedo usar mi dominio propio?**
Sí. En Netlify, Domain management → Add custom domain.
Necesitarás comprar un dominio (~$10/año en Namecheap o Google Domains).
