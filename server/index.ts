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

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { runMigrations, verifyDbConsistency, getProjectsTableDebug } from "./supabase";
import { createServer, type Server } from "http";

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

      console.log(logLine);
    }
  });

  next();
});

export const serverPromise = (async () => {
  try {
    // Executar migrações do banco de dados
    await runMigrations();
    console.log('Migrações do banco de dados concluídas com sucesso!');
  } catch (error) {
    console.log('Erro ao executar migrações do banco de dados:');
    console.error(error);
    // Continuar a execução mesmo se as migrações falharem
  }

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

  // API Routes
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const debug = await getProjectsTableDebug();
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        database: debug.error ? "error" : "connected",
        debug 
      });
    } catch (error: any) {
      res.status(500).json({ 
        status: "error", 
        message: error?.message || "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      const mockCustomers = [
        { id: 1, name: "Cliente Exemplo 1", email: "cliente1@example.com", phone: "11999999999", createdAt: new Date().toISOString() },
        { id: 2, name: "Cliente Exemplo 2", email: "cliente2@example.com", phone: "11888888888", createdAt: new Date().toISOString() }
      ];
      res.json(mockCustomers);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const mockProducts = [
        { id: 1, name: "Produto Exemplo 1", price: 100.00, stock: 10, createdAt: new Date().toISOString() },
        { id: 2, name: "Produto Exemplo 2", price: 200.00, stock: 5, createdAt: new Date().toISOString() }
      ];
      res.json(mockProducts);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  app.get("/api/finance", async (req: Request, res: Response) => {
    try {
      const mockFinance = [
        { id: 1, type: "income", amount: 1000.00, description: "Venda", createdAt: new Date().toISOString() },
        { id: 2, type: "expense", amount: 500.00, description: "Compra", createdAt: new Date().toISOString() }
      ];
      res.json(mockFinance);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  app.get("/api/quotes", async (req: Request, res: Response) => {
    try {
      const mockQuotes = [
        { id: 1, customerName: "Cliente 1", total: 1500.00, status: "pending", createdAt: new Date().toISOString() },
        { id: 2, customerName: "Cliente 2", total: 2500.00, status: "approved", createdAt: new Date().toISOString() }
      ];
      res.json(mockQuotes);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  const server = createServer(app);

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
    // await setupVite(app, server); // Desabilitado para Vercel
  } else if (!process.env.VERCEL) {
    // serveStatic(app); // Desabilitado para Vercel
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
      console.log(`serving on port ${port}`);
    });
  });
}

