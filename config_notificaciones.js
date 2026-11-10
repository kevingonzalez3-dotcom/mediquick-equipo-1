   // La clave se lee desde una variable de entorno (GitHub Secrets / .env)
   const NOTIFICACIONES_API_KEY = process.env.NOTIFICACIONES_API_KEY;

   module.exports = { NOTIFICACIONES_API_KEY };
