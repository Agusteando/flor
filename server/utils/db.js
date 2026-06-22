import mysql from 'mysql2/promise';
import { envValue } from './env.js';

let pool;

export const getPool = () => {
  if (pool) return pool;
  
  // useRuntimeConfig is auto-imported by Nitro
  const config = useRuntimeConfig();
  
  pool = mysql.createPool({
    host: envValue('DB_HOST', config.dbHost),
    port: Number(envValue('DB_PORT', config.dbPort || '3306')),
    user: envValue('DB_USER', config.dbUser),
    password: envValue('DB_PASSWORD', config.dbPass),
    database: envValue('DB_NAME', config.dbName),
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  
  return pool;
};