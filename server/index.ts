// Carregar variáveis de ambiente antes de importar outros módulos
import dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = new URL('.', import.meta.url).pathname;

// Carregar variáveis de ambiente do arquivo .env
const result = dotenv.config({ path: resolve(process.cwd(), '.env') });

if (result.error) {
  console.error('Erro ao carregar o arquivo .env:', result.error);
  process.exit(1);
}

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations, verifyDbConsistency } from "./supabase";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS for hosting: allow configured origins or all in development
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: (_origin, callback) => {
      if (!allowedOrigins.length || !_origin) return callback(null, true);
      const allowed = allowedOrigins.some((o) => _origin === o);
      callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
    },
    credentials: true,
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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

const serverPromise = (async () => {
  try {
    // Executar migrações do banco de dados
    await runMigrations();
    log('Migrações do banco de dados concluídas com sucesso!');
  } catch (error) {
    log('Erro ao executar migrações do banco de dados:');
    console.error(error);
    // Continuar a execução mesmo se as migrações falharem
  }

  const server = await registerRoutes(app);

  // Verificar conexão/consistência do DB usado por este processo
  await verifyDbConsistency();

  // Health check for platforms
  app.get("/health", (_req: Request, res: Response) => res.status(200).json({ status: "ok" }));

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

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  return server;
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
      log(`serving on port ${port}`);
    });
  });
}

