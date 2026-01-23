import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getProjectsTableDebug } from "./supabase";

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

// Simple health check endpoint
export async function registerRoutes(app: Express): Promise<Server> {
  // Health check
  app.get("/api/health", async (req: Request, res: Response) => {
    try {
      const debug = await getProjectsTableDebug();
      res.json({ 
        status: "ok", 
        timestamp: new Date().toISOString(),
        database: debug.error ? "error" : "connected",
        debug 
      });
    } catch (error) {
      res.status(500).json({ 
        status: "error", 
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Simple customers endpoint
  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      const items = await storage.getCustomers();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Simple products endpoint
  app.get("/api/products", async (req: Request, res: Response) => {
    try {
      const items = await storage.getProducts();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Simple finance endpoint
  app.get("/api/finance", async (req: Request, res: Response) => {
    try {
      const items = await storage.getFinanceEntries();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Simple quotes endpoint
  app.get("/api/quotes", async (req: Request, res: Response) => {
    try {
      const items = await storage.getQuotes();
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // Simple notifications endpoint
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      // Return empty notifications for now
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
