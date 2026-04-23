# SaludAvisa

## Ejecutar en web

```bash
npm install
npm run dev
```

## Convertir a app movil (Android)

Este proyecto usa Capacitor para empaquetar la app web como app nativa movil.

1. Instala dependencias:

```bash
npm install
```

2. Genera build web y sincroniza con proyecto nativo:

```bash
npm run mobile:build
```

3. Crea la plataforma Android (solo la primera vez):

```bash
npx cap add android
```

4. Abre Android Studio para compilar o ejecutar en emulador/dispositivo:

```bash
npm run mobile:android
```

## Nota para iOS

La carpeta iOS se puede generar con `npx cap add ios`, pero su compilacion requiere macOS + Xcode.
