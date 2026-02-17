import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

// Log simples para checar se as variáveis estão sendo carregadas
console.log("DB config usada pelo backend:", {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
});

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "appemp",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});


