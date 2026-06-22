import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

let loaded = false;
let cachedEnv = null;

export function loadServerEnv() {
  if (loaded) return cachedEnv;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '../../.env'),
  ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
    break;
  }

  loaded = true;
  cachedEnv = process.env;
  return cachedEnv;
}

export function envValue(name, fallback = '') {
  const env = loadServerEnv();
  const value = env[name];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : fallback;
}
