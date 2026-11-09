
import express, { type Express } from "express";
import cors from "cors";

const app: Express = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Ruta de bienvenida
app.get("/", (_req, res) => {
  res.status(200).json({
    message: "Bienvenido a MediQuick Digital API",
    status: "online",
    version: "1.0.0"
  });
});

// Ruta para comprobar el estado de la API
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "OK",
    message: "MediQuick Digital API funcionando correctamente"
  });
});

export default app;
