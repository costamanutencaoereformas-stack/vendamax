// Carregar variáveis de ambiente antes de importar outros módulos
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;

// Carregar variáveis de ambiente do arquivo .env
dotenv.config({ path: resolve(process.cwd(), '.env') });

// No Vercel, as variáveis são injetadas diretamente, então não falhamos se o .env não existir
if (!process.env.DATABASE_URL && !process.env.VERCEL) {
  console.warn('Aviso: DATABASE_URL não encontrada e não estamos no Vercel. Verifique seu arquivo .env');
}

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";

// Supabase integration
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

// Inicializar Supabase
let supabase: any = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log('✅ Supabase client initialized');
} else {
  console.log('⚠️ Supabase credentials not found, using mock data');
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS for hosting: allow configured origins or all in development
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Allow all origins in development
      if (process.env.NODE_ENV === 'development') return callback(null, true);

      // Allow Vercel frontend
      if (origin.includes('vercel.app') || origin.includes('vercel.com')) return callback(null, true);

      // Check against allowed origins
      if (!allowedOrigins.length) return callback(null, true);
      const allowed = allowedOrigins.some((o) => origin === o);
      callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          // Use a safe stringify to avoid crashes on circular refs or BigInt
          const safeJson = JSON.stringify(capturedJsonResponse, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          );
          logLine += ` :: ${safeJson}`;
        } catch (e) {
          logLine += ` :: [Serialization Error: ${e instanceof Error ? e.message : String(e)}]`;
        }
      }

      if (logLine.length > 150) { // Increased slightly for better debugging
        logLine = logLine.slice(0, 149) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// Adicionar tratador global para evitar crashes fatais no Vercel
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
});

export const serverPromise = (async () => {
  // Helper: parse date strings safely to avoid timezone shifting a day back
  function parseDateSafe(input: any): Date | undefined {
    if (!input) return undefined;
    if (input instanceof Date) return input;
    if (typeof input === 'string') {
      // If it's a pure date like YYYY-MM-DD, parse as local noon to avoid timezone shifts
      const m = input.match(/^\d{4}-\d{2}-\d{2}$/);
      if (m) {
        const [year, month, day] = input.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0, 0);
      }
      // If it's an ISO string, parse normally
      const d = new Date(input);
      return isNaN(d.getTime()) ? undefined : d;
    }
    try {
      const d = new Date(input);
      return isNaN(d.getTime()) ? undefined : d;
    } catch {
      return undefined;
    }
  }

  console.log('[DEBUG] serverPromise: Starting initialization...');
  try {
    const server = await registerRoutes(app);
    console.log('[DEBUG] serverPromise: Routes registered successfully');

    // Health check for platforms
    app.get("/api/health", async (_req: Request, res: Response) => {
      try {
        console.log('[DEBUG] /health - Verificando saúde do sistema');

        // Test database connection
        const storageModule = await import('./storage');
        const storage = storageModule.storage;
        const testConnection = await storage.getCustomers().catch(() => null);

        const health = {
          status: "ok",
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          isVercel: !!process.env.VERCEL,
          database: testConnection ? "connected" : "error",
          services: {
            supabase: {
              url: !!process.env.SUPABASE_URL,
              key: !!process.env.SUPABASE_ANON_KEY,
              database: !!process.env.DATABASE_URL
            }
          }
        };

        console.log('[DEBUG] /health - Status:', health);
        res.status(200).json(health);
      } catch (error: any) {
        console.error('[ERROR] /health - Erro:', error);
        res.status(500).json({
          status: "error",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Serve uploaded files (logos, etc.)
    app.use('/uploads', express.static(resolve(process.cwd(), 'uploads')));

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Always return JSON; don't throw after responding to avoid HTML error overlays
      try {
        if (!res.headersSent) {
          res.status(status).json({ message });
        }
      } catch (_) {
        // ignore
      }
      console.error("API error:", err);
    });

    return server;
  } catch (error) {
    console.error('[ERROR] serverPromise: Initialization failed!', error);
    throw error;
  }
})();

export default app;

// Start server if this is the main module
if (import.meta.url === `file://${process.argv[1]}` || process.env.NODE_ENV === 'development' || !process.env.VERCEL) {
  serverPromise.then((server) => {
    const port = parseInt(process.env.PORT || '5000', 10);
    server.listen({
      port,
      host: "0.0.0.0",
    }, () => {
      console.log(`serving on port ${port}`);
    });
  });
}

