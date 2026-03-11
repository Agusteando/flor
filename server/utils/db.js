import mysql from 'mysql2/promise';

let pool;

export const getPool = () => {
  if (pool) return pool;
  
  // useRuntimeConfig is auto-imported by Nitro
  const config = useRuntimeConfig();
  
  pool = mysql.createPool({
    host: config.dbHost,
    user: config.dbUser,
    password: config.dbPass,
    database: config.dbName,
    supportBigNumbers: true,
    bigNumberStrings: true,
  });
  
  return pool;
};