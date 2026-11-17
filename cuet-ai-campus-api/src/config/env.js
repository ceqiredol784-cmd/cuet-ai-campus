import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const uploadDirRaw = process.env.UPLOAD_DIR || 'uploads';

const rawOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
  port: int(process.env.PORT, 3000),
  mongoUri:
    process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cuet_ai_campus',
  jwtSecret:
    process.env.JWT_SECRET || 'cuet-ai-campus-development-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  corsOrigins: rawOrigins.includes('*') ? true : rawOrigins,
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  timeZone: process.env.APP_TIME_ZONE || 'Asia/Dhaka',
  autoSeed: bool(process.env.AUTO_SEED, false),
  demoPassword: process.env.DEMO_PASSWORD || 'Campus123',
  uploadDir: path.isAbsolute(uploadDirRaw)
    ? uploadDirRaw
    : path.join(root, uploadDirRaw),
  maxUploadMb: int(process.env.MAX_UPLOAD_MB, 20),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiBaseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(
    /\/+$/,
    ''
  ),
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL || 'crazymahfuj1@gmail.com',
  passwordResetUrl:
    process.env.PASSWORD_RESET_URL || 'http://localhost:5173/reset-password',
  passwordResetExpiresMinutes: int(process.env.PASSWORD_RESET_EXPIRES_MINUTES, 15),
  root,
});

export const publicUrl = (relativePath) => {
  const clean = `/${String(relativePath).replace(/^\/+/, '')}`;
  if (!env.publicBaseUrl) return clean;
  return `${env.publicBaseUrl}${clean}`;
};
