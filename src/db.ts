
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const entornoPruebas = process.env.NODE_ENV === "test";

const connectionString = entornoPruebas
  ? process.env.DATABASE_URL_TEST
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    entornoPruebas
      ? "La variable DATABASE_URL_TEST no está configurada"
      : "La variable DATABASE_URL no está configurada"
  );
}

export const pool = new Pool({
  connectionString
});

pool.on("error", (error) => {
  console.error(
    "Error inesperado en el pool de PostgreSQL:",
    error
  );
});
