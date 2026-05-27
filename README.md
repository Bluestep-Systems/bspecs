# @bluestep/bspecs

CLI para scaffoldear proyectos BlueStep con convenciones de desarrollo spec-driven para Claude Code y GitHub Copilot.

## ¿Qué hace?

`bspecs` genera un directorio de proyecto listo para usar con:

- Skills de Claude Code (`/spec-create`, `/spec-execute`, `/b6p-pull`, `/b6p-push`, y más)
- Hooks automáticos (prettier on save, bloqueo de archivos generados, integración con `b6p`)
- Instructions para Claude Code y GitHub Copilot (fuente única de verdad)
- Templates de specs (`requirements.md`, `design.md`, `tasks.md`)
- Detección automática del entorno `b6p`

## Instalación

Requiere acceso al GitHub Packages de la organización Bluestep. Configurá tu `.npmrc` una sola vez:

```sh
echo "@bluestep:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm login --scope=@bluestep --registry=https://npm.pkg.github.com
```

Luego instalá el CLI globalmente:

```sh
npm install -g @bluestep/bspecs
```

## Uso

### Scaffoldear un proyecto nuevo

Desde el directorio padre donde querés crear el proyecto:

```sh
bspecs
```

El wizard interactivo pregunta nombre del proyecto, cliente, descripción y API key de Context7. Al terminar genera el directorio del proyecto con toda la estructura lista y hace `git init`.

### Mantener un proyecto actualizado

Cuando se publica una nueva versión de `bspecs` con mejoras en skills, hooks o instrucciones, actualizá tu instalación global y luego sincronizá el proyecto:

```sh
npm update -g @bluestep/bspecs
cd mi-proyecto
bspecs sync
```

`bspecs sync` compara cada archivo de infraestructura con el estado en que fue scaffoldeado. Los archivos que no modificaste localmente se actualizan; los que sí editaste se dejan intactos con un aviso.

Los proyectos scaffoldeados con `bspecs 0.5.0` o posterior corren `bspecs sync` automáticamente cada vez que Claude Code abre el workspace — no necesitás hacer nada manualmente.

## Prerrequisitos

- **Node.js 18+**
- **`b6p` CLI** — necesario para las skills `/b6p-pull`, `/b6p-push` y `/b6p-audit`. Si no está instalado, `bspecs` avisa con instrucciones al hacer el scaffold.
- **prettier** — necesario para el hook de formateo automático. `bspecs` avisa si no lo encuentra.

## Estructura generada

```
mi-proyecto/
├── CLAUDE.md                          ← instrucciones del proyecto para Claude
├── README.md                          ← documentación del proyecto
├── .prettierrc
├── .gitignore
├── .claude/
│   ├── bspecs.lock                    ← lock file para bspecs sync
│   ├── b6p-env.json                   ← entorno b6p detectado
│   ├── settings.json                  ← permisos y hooks de Claude Code
│   ├── hooks/                         ← 4 scripts ejecutados por Claude Code
│   ├── skills/                        ← 8 skills (/spec-create, /b6p-pull, etc.)
│   ├── instructions/                  ← reglas de desarrollo para Claude
│   ├── spec-templates/                ← plantillas de specs
│   └── templates/                     ← templates de componentes
├── .github/
│   └── instructions/                  ← mirrors para GitHub Copilot
└── .vscode/
    └── mcp.json                       ← Context7 MCP
```

## Proponer cambios

### Cambios globales (mejoras para todos los proyectos)

Si encontrás algo que debería mejorar en las skills, hooks, instrucciones o templates — algo que sería útil para todos los proyectos BlueStep — abrí un issue o PR en este repo. Una vez mergeado y publicada una nueva versión, `bspecs sync` propaga el cambio a todos los proyectos existentes.

### Cambios locales (específicos de tu proyecto)

Si necesitás ajustar algo solo para tu proyecto (un permiso extra en `settings.json`, una skill custom, cambios en tu `CLAUDE.md`), hacélo directamente en tu repo. `bspecs sync` detecta que esos archivos fueron editados y los deja intactos en futuras sincronizaciones.

## Publicación

El paquete se publica en GitHub Packages (`https://npm.pkg.github.com`) bajo la organización `@bluestep`. Solo los archivos `cli.js`, `src/` y `templates/` se incluyen en el paquete publicado.
