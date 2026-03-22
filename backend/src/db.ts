import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const useSsl =
  process.env.DB_SSL === "true" ||
  process.env.DB_SSL === "1" ||
  Boolean(databaseUrl);

const sslConfig = useSsl ? { rejectUnauthorized: false } : undefined;

// Log simples para checar se as variáveis estão sendo carregadas
console.log("DB config usada pelo backend:", {
  DATABASE_URL: databaseUrl ? "[definida]" : undefined,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_SSL: process.env.DB_SSL,
});

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: sslConfig,
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || "appemp",
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: sslConfig,
    });

