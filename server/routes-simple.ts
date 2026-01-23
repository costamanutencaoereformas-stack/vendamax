import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
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
    } catch (error: any) {
      res.status(500).json({ 
        status: "error", 
        message: error?.message || "Unknown error",
        timestamp: new Date().toISOString()
      });
    }
  });

  // Simple customers endpoint - returns mock data for now
  app.get("/api/customers", async (req: Request, res: Response) => {
    try {
      // Return mock data to avoid storage dependency issues
      const mockCustomers = [
        { id: 1, name: "Cliente Exemplo 1", email: "cliente1@example.com", phone: "11999999999", createdAt: new Date().toISOString() },
        { id: 2, name: "Cliente Exemplo 2", email: "cliente2@example.com", phone: "11888888888", createdAt: new Date().toISOString() }
      ];
      res.json(mockCustomers);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  // Simple products endpoint - returns mock data for now
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

  // Simple finance endpoint - returns mock data for now
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

  // Simple quotes endpoint - returns mock data for now
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

  // Simple notifications endpoint - returns empty for now
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      // Return empty notifications for now
      res.json([]);
    } catch (error: any) {
      res.status(500).json({ message: error?.message || "Unknown error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
