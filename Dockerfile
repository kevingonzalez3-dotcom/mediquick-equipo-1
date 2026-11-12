# FROM: imagen base oficial de Node 20 en Alpine; "AS build" nombra la etapa de compilación
FROM node:20-alpine AS build

# WORKDIR: carpeta de trabajo dentro del contenedor
WORKDIR /app

# COPY: copio primero los archivos de dependencias para aprovechar la caché de capas
COPY package*.json ./

# RUN: instalo las dependencias exactas del package-lock.json (reproducible)
RUN npm ci

# COPY: copio el código fuente del proyecto
COPY . .

# RUN: compilo TypeScript a JavaScript (genera la carpeta dist/)
RUN npm run build

# FROM: segunda etapa, imagen limpia solo para ejecutar
FROM node:20-alpine

# WORKDIR: carpeta de trabajo de la imagen final
WORKDIR /app

# ENV: modo producción
ENV NODE_ENV=production

# COPY: dependencias de producción
COPY package*.json ./

# RUN: instalo solo dependencias de producción (sin eslint, typescript, etc.)
RUN npm ci --omit=dev

# COPY: traigo únicamente el código compilado desde la etapa anterior
COPY --from=build /app/dist ./dist

# EXPOSE: puerto en el que escucha la API (AJUSTAR si index.ts usa otro)
EXPOSE 3000

# CMD: comando que arranca la API (equivale a "npm start")
CMD ["node", "dist/index.js"]
