
import app from "./app";

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("------------------------------------");
  console.log("   MEDIQUICK DIGITAL API");
  console.log("------------------------------------");
  console.log(`Servidor activo en el puerto ${PORT}`);
  console.log(`URL local: http://localhost:${PORT}`);
  console.log(`Estado: http://localhost:${PORT}/health`);
  console.log("------------------------------------");
});
