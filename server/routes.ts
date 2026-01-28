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

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getProjectsTableDebug } from "./supabase";
import {
  insertCustomerSchema,
  insertSupplierSchema,
  insertCategorySchema,
  insertSegmentSchema,
  insertProductSchema,
  insertInventorySchema,
  insertQuoteSchema,
  insertQuoteItemSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertAppointmentSchema,
  insertFinanceSchema,
  insertCompanySettingsSchema,
  insertProjectSchema,
  insertProjectTaskSchema,
  insertProjectExpenseSchema,
  insertProjectDocumentSchema,
  insertPurchaseRequestSchema,
  insertPurchaseRequestItemSchema,
  insertContractSchema,
  insertContractDocumentSchema,
  insertNoteSchema
} from "@shared/schema";
import { z } from "zod";
import multer, { FileFilterCallback } from 'multer';
import { parseStringPromise } from "xml2js";
import path from 'path';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import googleDrive from './google-drive';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
      file?: Express.Multer.File;
    }
  }
}

// File filter function
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado'));
  }
};

// Configure multer for file uploads
const uploadStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const uploadDir = path.join(process.cwd(), 'uploads');

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `file-${uniqueSuffix}${ext}`);
  },
});

// Configure multer instance
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter
});

// Configure dedicated storage for Project Documents (save into uploads/projects/:projectId)
const projectUploadStorage = multer.diskStorage({
  destination: async (req: Request, file, cb) => {
    try {
      const projectId = (req.params as any)?.id || 'general';
      const uploadDir = path.join(process.cwd(), 'uploads', 'projects', projectId);
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname) || '';
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const projectUpload = multer({
  storage: projectUploadStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for project docs
  fileFilter
});

// Configure dedicated storage for Product Images (save into uploads/products)
const productUploadStorage = multer.diskStorage({
  destination: async (req: Request, file, cb) => {
    try {
      const uploadDir = path.join(process.cwd(), 'uploads', 'products');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname) || '';
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

const productUpload = multer({
  storage: productUploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for product images
  fileFilter
});

// Função para parsing de XML da NFe (implementada no servidor)
async function parseNFEXML(xmlContent: string) {
  const result: any = await parseStringPromise(xmlContent, { explicitArray: false });

  // Buscar estrutura da NFe
  const nfeProc = result.nfeProc || result;
  const nfe = nfeProc.NFe || nfeProc.nfe;
  if (!nfe) {
    throw new Error('XML não é uma NFe válida');
  }

  const infNFe = nfe.infNFe;
  if (!infNFe) {
    throw new Error('Informações da NFe não encontradas');
  }

  // Extrair dados do emitente
  const emit = infNFe.emit;
  if (!emit) {
    throw new Error('Dados do emitente não encontrados no XML');
  }

  const supplier = {
    cnpj: emit.CNPJ || '',
    name: emit.xNome || '',
    email: emit.email || null,
    phone: emit.fone || null,
    address: emit.enderEmit?.xLgr || null,
    city: emit.enderEmit?.xMun || null,
    state: emit.enderEmit?.UF || null,
    zipCode: emit.enderEmit?.CEP || null,
  };

  if (!supplier.cnpj || !supplier.name) {
    throw new Error('CNPJ ou nome do fornecedor não encontrados');
  }

  // Extrair produtos
  const detArray = Array.isArray(infNFe.det) ? infNFe.det : [infNFe.det];
  const products = detArray
    .filter((det: any) => det && det.prod)
    .map((det: any) => {
      const prod = det.prod;
      // Parse numeric fields defensively. Some invoices use slightly different tag names
      const qCom = parseFloat(prod.qCom || prod.quantity || '0');
      const vUnCom = parseFloat(prod.vUnCom || prod.vUn || '0');
      const vProd = parseFloat(prod.vProd || prod.vProduct || '0');
      // Discount can appear as vDesc or desconto/desc in different emitters.
      const discount = parseFloat(prod.vDesc || prod.desc || prod.desconto || '0');

      return {
        cProd: prod.cProd || '',
        xProd: prod.xProd || '',
        NCM: prod.NCM || null,
        CFOP: prod.CFOP || null,
        uCom: prod.uCom || 'UN',
        qCom,
        vUnCom,
        vProd,
        // discount amount (numeric). 0 when not present.
        discount,
        // helper flag for convenience
        hasDiscount: !!(discount && discount > 0),
      };
    })
    .filter((product: any) => product.cProd && product.xProd && product.qCom > 0);

  if (products.length === 0) {
    throw new Error('Nenhum produto válido encontrado no XML');
  }

  return {
    supplier,
    products,
    nfeNumber: infNFe.ide?.nNF || null,
    nfeDate: infNFe.ide?.dhEmi || null,
  };
}

// Admin-only middleware using role propagated via headers
function adminOnly(req: Request, res: Response, next: Function) {
  try {
    const roleHeader = (req.headers["x-user-role"] || req.headers["x-role"]) as string | undefined;
    const role = (roleHeader || "").toString().toLowerCase();
    if (process.env.DISABLE_AUTH === "1") return next();
    if (role === "admin") return next();
    return res.status(403).json({ message: "Forbidden: admin required" });
  } catch (e: any) {
    return res.status(403).json({ message: "Forbidden" });
  }
}

// Cash register validation middleware
function checkCashRegister(req: Request, res: Response, next: Function) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Skip check if DISABLE_AUTH is enabled
    if (process.env.DISABLE_AUTH === "1") return next();

    storage.getCurrentCashRegister().then(register => {
      if (!register) {
        return res.status(400).json({
          message: "Caixa não aberto",
          details: "É necessário abrir o caixa do dia antes de realizar vendas"
        });

        // (Excel routes removed from this block)

        // (moved) Excel routes placed below, outside this middleware



      }

      const registerDate = new Date(register.openedAt || new Date());
      registerDate.setHours(0, 0, 0, 0);

      // Check if register is from previous day
      if (registerDate < today) {
        return res.status(400).json({
          message: "Caixa do dia anterior aberto",
          details: "É necessário fechar o caixa do dia anterior antes de abrir um novo"
        });
      }

      // Check if register is from future day (shouldn't happen)
      if (registerDate > today) {
        return res.status(400).json({
          message: "Caixa de data futura aberto",
          details: "Data de abertura do caixa é inválida"
        });
      }

      // All checks passed
      next();
    }).catch(error => {
      console.error("Erro ao verificar caixa:", error);
      res.status(500).json({ message: "Erro ao verificar status do caixa" });
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
}

// Schema para validação de login
const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

// Função para garantir que o usuário administrador exista
async function ensureAdminUser() {
  try {
    // Verificar se já existe um usuário admin
    const existingAdmin = await storage.getUserByUsername('admin');

    if (!existingAdmin) {
      console.log('Criando usuário administrador padrão...');
      // Criar usuário admin padrão com todos os campos obrigatórios
      await storage.createUser({
        username: 'admin',
        password: 'admin123', // Em produção, usar senha forte e hash
        name: 'Administrador',
        role: 'admin',
        email: 'admin@example.com',
        phone: '',
        isActive: true
      } as any);

      console.log('Usuário administrador criado com sucesso!');
    } else {
      console.log('Usuário administrador já existe.');
    }
  } catch (error) {
    console.error('⚠️ [Warning] Erro ao garantir usuário administrador (não fatal):', error);
    // Não re-lançamos o erro para não travar a inicialização do servidor
  }
}

// Função para carregar dados de exemplo no banco de dados
async function loadSampleData() {
  try {
    // Verificar se já existem dados
    const existingProducts = await storage.getProducts();
    if (existingProducts.length > 0) {
      console.log('Dados de exemplo já existem no banco de dados.');
      return;
    }

    // Criar categorias
    const categories = [
      { name: 'Ferramentas Elétricas', description: 'Ferramentas que utilizam energia elétrica' },
      { name: 'Ferramentas Manuais', description: 'Ferramentas operadas manualmente' },
      { name: 'Material de Construção', description: 'Materiais para construção civil' },
      { name: 'Equipamentos de Segurança', description: 'EPIs e equipamentos de proteção' },
      { name: 'Acessórios', description: 'Acessórios diversos para ferramentas' }
    ];

    // Verificar se as categorias já existem
    const existingCategories = await storage.getCategories();
    let createdCategories = [];

    if (existingCategories.length === 0) {
      // Criar categorias se não existirem
      for (const category of categories) {
        const newCategory = await storage.createCategory(category);
        createdCategories.push(newCategory);
        console.log(`Categoria criada: ${newCategory.name}`);
      }
    } else {
      // Usar categorias existentes
      createdCategories = existingCategories;
      console.log('Usando categorias existentes do banco de dados.');
    }

    // Criar produtos
    const products = [
      {
        code: 'FUR-750-IMP',
        name: 'Furadeira de Impacto 750W',
        description: 'Furadeira de impacto profissional com potência de 750W',
        categoryId: createdCategories[0].id,
        costPrice: 250.00,
        salePrice: 299.90,
        currentStock: 15,
        minimumStock: 5,
        isActive: true
      },
      {
        code: 'MART-29-UNH',
        name: 'Martelo de Unha 29mm',
        description: 'Martelo de unha com cabo de madeira',
        categoryId: createdCategories[1].id,
        costPrice: 35.00,
        salePrice: 45.90,
        currentStock: 30,
        minimumStock: 10,
        isActive: true
      },
      {
        code: 'CIM-PORT-50',
        name: 'Cimento Portland 50kg',
        description: 'Saco de cimento Portland de alta resistência',
        categoryId: createdCategories[2].id,
        costPrice: 25.00,
        salePrice: 32.50,
        currentStock: 50,
        minimumStock: 20,
        isActive: true
      },
      {
        code: 'CAP-SEG-01',
        name: 'Capacete de Segurança',
        description: 'Capacete de segurança com carneira',
        categoryId: createdCategories[3].id,
        costPrice: 18.00,
        salePrice: 25.90,
        currentStock: 40,
        minimumStock: 15,
        isActive: true
      },
      {
        code: 'BRO-CON-10',
        name: 'Broca para Concreto 10mm',
        description: 'Broca para furadeira para uso em concreto',
        categoryId: createdCategories[4].id,
        costPrice: 8.50,
        salePrice: 12.90,
        currentStock: 25,
        minimumStock: 8,
        isActive: true
      }
    ];

    for (const product of products) {
      const newProduct = await storage.createProduct(product as any);
      console.log(`Produto criado: ${newProduct.name}`);
    }

    // Criar clientes
    const sampleCustomers = [
      {
        name: 'PORCA ELETRICA COMERCIO DE FERRAGENS LTDA',
        email: 'contato@porcaeletrica.com.br',
        phone: '11987654321',
        address: 'Rua das Ferramentas, 123',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01234-567',
        notes: 'Cliente corporativo com compras mensais'
      },
      {
        name: 'CONSTRUTORA ALICERCE FORTE LTDA',
        email: 'compras@alicerteforte.com.br',
        phone: '11912345678',
        address: 'Av. dos Construtores, 456',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '04567-890',
        notes: 'Construtora de médio porte'
      },
      {
        name: 'JOÃO SILVA REFORMAS ME',
        email: 'joao.silva@reformas.com',
        phone: '11955554444',
        address: 'Rua das Obras, 789',
        city: 'Guarulhos',
        state: 'SP',
        postalCode: '07123-456',
        notes: 'Pequeno empreiteiro'
      }
    ];

    for (const customer of sampleCustomers) {
      const newCustomer = await storage.createCustomer(customer as any);
      console.log(`Cliente criado: ${newCustomer.name}`);
    }

    // Criar fornecedores
    const suppliers = [
      {
        name: 'FERRAMENTAS BRASIL DISTRIBUIDORA LTDA',
        tradeName: 'Ferramentas Brasil',
        cnpj: '12.345.678/0001-90',
        email: 'vendas@ferramentasbrasil.com.br',
        phone: '11988887777',
        address: 'Rodovia dos Fornecedores, 1000',
        city: 'Campinas',
        state: 'SP',
        zipCode: '13000-000',
        paymentTerms: '30 dias',
        isActive: true
      },
      {
        name: 'CIMENTO FORTE INDUSTRIA S.A.',
        tradeName: 'Cimento Forte',
        cnpj: '98.765.432/0001-10',
        email: 'comercial@cimentoforte.com.br',
        phone: '11933332222',
        address: 'Estrada da Indústria, 500',
        city: 'Sorocaba',
        state: 'SP',
        zipCode: '18000-000',
        paymentTerms: '21 dias',
        isActive: true
      }
    ];

    for (const supplier of suppliers) {
      const newSupplier = await storage.createSupplier(supplier as any);
      console.log(`Fornecedor criado: ${newSupplier.name}`);
    }

    console.log('Dados de exemplo carregados com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar dados de exemplo:', error);
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Garantir que o usuário admin exista
  await ensureAdminUser();
  // Auto-migração leve: garantir coluna finance.code e índice
  try {
    await (storage as any).ensureFinanceCode?.();
  } catch (e) {
    console.warn('[startup] ensureFinanceCode non-fatal:', e as any);
  }
  // Auto-migração: criar tabelas auxiliares de produto, se necessário
  try {
    await (storage as any).ensureProductAuxTables?.();
  } catch (e) {
    console.warn('[startup] ensureProductAuxTables non-fatal:', e as any);
  }
  // Auto-migração: garantir colunas brand e ncm
  try {
    await (storage as any).ensureProductExtraColumns?.();
  } catch (e) {
    console.warn('[startup] ensureProductExtraColumns non-fatal:', e as any);
  }

  // Carregamento automático de dados de exemplo desabilitado
  // Caso necessário, execute o script manual de seed: `npm run seed:all`

  // Debug: show DB and projects table columns (must be outside ensureAdminUser)
  app.get("/api/_debug/projects-columns", async (_req, res) => {
    try {
      const info = await getProjectsTableDebug();
      res.json(info);
    } catch (e: any) {
      res.status(500).json({ message: e.message || 'debug error' });
    }
  });
  // Autenticação
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = loginSchema.parse(req.body);

      // Buscar usuário pelo nome de usuário
      const user = await storage.getUserByUsername(username);

      // Verificar se o usuário existe e a senha está correta
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      // Retornar dados do usuário (exceto a senha)
      const { password: _, ...userWithoutPassword } = user;

      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Usuários
  const userSchema = z.object({
    username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    name: z.string().min(1, "Nome é obrigatório"),
    role: z.enum(["admin", "user"], {
      errorMap: () => ({ message: "Função deve ser 'admin' ou 'user'" }),
    }),
  });

  // Listar usuários
  app.get("/api/users", async (req: Request, res: Response) => {
    try {
      // Obter todos os usuários
      const users = await Promise.all(
        Array.from(await storage.getAllUsers()).map(async (user) => {
          // Remover senha dos dados retornados
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        })
      );

      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Criar usuário
  app.post("/api/users", async (req: Request, res: Response) => {
    try {
      const userData = userSchema.parse(req.body);

      // Verificar se já existe um usuário com o mesmo username
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }

      // Criar o usuário
      const newUser = await storage.createUser(userData);

      // Remover senha dos dados retornados
      const { password, ...userWithoutPassword } = newUser;

      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Dashboard
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reports: Monthly evolution (last 6 months)
  app.get("/api/reports/monthly", async (req: Request, res: Response) => {
    try {
      const sales = await storage.getSales();
      const quotes = await storage.getQuotes();

      const result: Array<{ month: string; sales: number; salesCount: number; quotes: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

        const monthSales = sales.filter((sale: any) => {
          if (!sale.createdAt) return false;
          const d = new Date(sale.createdAt);
          return d >= monthStart && d <= monthEnd;
        });

        const monthQuotes = quotes.filter((quote: any) => {
          if (!quote.createdAt) return false;
          const d = new Date(quote.createdAt);
          return d >= monthStart && d <= monthEnd;
        });

        result.push({
          month: date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
          sales: monthSales.reduce((sum: number, s: any) => sum + (parseFloat(s.total) || 0), 0),
          salesCount: monthSales.length,
          quotes: monthQuotes.length,
        });
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Customers
  app.get("/api/customers", async (req, res) => {
    try {
      console.log('[DEBUG] /api/customers - Iniciando requisição');
      console.log('[DEBUG] Environment:', process.env.NODE_ENV);
      console.log('[DEBUG] Vercel:', !!process.env.VERCEL);

      const customers = await storage.getCustomers();
      console.log('[DEBUG] /api/customers - Retornando', customers?.length || 0, 'clientes');

      // Ensure we always return an array
      const safeCustomers = Array.isArray(customers) ? customers : [];
      res.json(safeCustomers);
    } catch (error: any) {
      console.error('[ERROR] /api/customers - Erro:', error);
      // Return empty array as fallback to prevent 500 errors
      res.status(500).json({
        message: "Erro ao carregar clientes",
        data: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.json(customer);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(customerData);
      res.status(201).json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const customerData = insertCustomerSchema.partial().parse(req.body);
      const customer = await storage.updateCustomer(req.params.id, customerData);
      res.json(customer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Customer not found" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Customer total sales
  app.get("/api/customers/:id/total-sales", async (req, res) => {
    try {
      const customerId = req.params.id;
      const sales = await storage.getSales();
      const customerSales = sales.filter((sale: any) => sale.customerId === customerId);

      const totalSales = customerSales.reduce((sum: number, sale: any) => {
        return sum + (parseFloat(sale.total) || 0);
      }, 0);

      const completedSales = customerSales.filter((sale: any) => sale.status === 'COMPLETED');
      const totalCompletedSales = completedSales.reduce((sum: number, sale: any) => {
        return sum + (parseFloat(sale.total) || 0);
      }, 0);

      res.json({
        totalSales,
        totalCompletedSales,
        salesCount: customerSales.length,
        completedSalesCount: completedSales.length
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notifications endpoint
  app.get("/api/notifications", async (req, res) => {
    try {
      const notifications: Array<{
        id: string;
        type: string;
        title: string;
        message: string;
        date: Date;
        priority: 'high' | 'medium' | 'low';
      }> = [];
      const today = new Date();

      try {
        // Get expired quotes
        const quotes = await storage.getQuotes();
        const expiredQuotes = (quotes || []).filter((quote: any) => {
          if (!quote?.validUntil) return false;
          const validUntil = new Date(quote.validUntil);
          if (isNaN(validUntil.getTime())) return false;
          return validUntil < today && quote.status === 'PENDING';
        });

        expiredQuotes.forEach((quote: any) => {
          notifications.push({
            id: `quote-${quote.id}`,
            type: 'expired_quote',
            title: 'Orçamento Vencido',
            message: `Orçamento ${quote.number} venceu em ${quote?.validUntil ? new Date(quote.validUntil).toLocaleDateString('pt-BR') : ''}`,
            date: quote?.validUntil || today,
            priority: 'high'
          });
        });
      } catch (error) {
        console.warn('[Notifications] Error fetching quotes:', error);
      }

      try {
        // Get overdue finance entries
        const financeEntries = await storage.getFinanceEntries();
        const overdueEntries = (financeEntries || []).filter((entry: any) => {
          if (!entry?.dueDate || entry.status === 'PAID') return false;
          const dueDate = new Date(entry.dueDate);
          if (isNaN(dueDate.getTime())) return false;
          return dueDate < today;
        });

        overdueEntries.forEach((entry: any) => {
          const isReceivable = entry.entryType === 'RECEIVABLE';
          notifications.push({
            id: `finance-${entry.id}`,
            type: isReceivable ? 'overdue_receivable' : 'overdue_payable',
            title: isReceivable ? 'Conta a Receber Vencida' : 'Conta a Pagar Vencida',
            message: `${entry.description} - Vencimento: ${new Date(entry.dueDate).toLocaleDateString('pt-BR')}`,
            date: entry.dueDate,
            priority: 'high'
          });
        });
      } catch (error) {
        console.warn('[Notifications] Error fetching finance entries:', error);
      }

      try {
        // Get today's appointments
        const appointments = await storage.getAppointments();
        const todayAppointments = (appointments || []).filter((appointment: any) => {
          if (!appointment?.date) return false;
          const appointmentDate = new Date(appointment.date);
          if (isNaN(appointmentDate.getTime())) return false;
          return appointmentDate.toDateString() === today.toDateString() && appointment.status === 'PENDING';
        });

        todayAppointments.forEach((appointment: any) => {
          notifications.push({
            id: `appointment-${appointment.id}`,
            type: 'appointment_reminder',
            title: 'Compromisso Hoje',
            message: `${appointment.subject || 'Compromisso'} - ${new Date(appointment.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
            date: appointment.date,
            priority: 'medium'
          });
        });
      } catch (error) {
        console.warn('[Notifications] Error fetching appointments:', error);
      }

      // Sort by priority and date
      notifications.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      res.json(notifications);
    } catch (error: any) {
      console.error("Erro ao buscar notificações:", error);
      // Return empty array as fallback to prevent 500 errors
      res.status(500).json({
        message: "Erro interno ao buscar notificações",
        data: [],
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Appointments (Agenda)
  app.get("/api/appointments", async (req: Request, res: Response) => {
    try {
      const items = await storage.getAppointments();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/appointments/:id", async (req, res) => {
    try {
      const item = await storage.getAppointment(req.params.id);
      if (!item) return res.status(404).json({ message: "Appointment not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/appointments", async (req: Request, res: Response) => {
    try {
      const bodyData: any = { ...req.body };
      if (bodyData.date && typeof bodyData.date === 'string') {
        bodyData.date = new Date(bodyData.date);
      }
      const data = insertAppointmentSchema.parse(bodyData);
      const created = await storage.createAppointment(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/appointments/:id", async (req, res) => {
    try {
      const bodyData: any = { ...req.body };
      if (bodyData.date && typeof bodyData.date === 'string') {
        bodyData.date = new Date(bodyData.date);
      }
      const updated = await storage.updateAppointment(req.params.id, bodyData);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const ok = await storage.deleteAppointment(req.params.id);
      if (!ok) return res.status(404).json({ message: "Appointment not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // CNPJ lookup
  app.get("/api/cnpj/:cnpj", async (req, res) => {
    try {
      const cnpj = req.params.cnpj.replace(/[^\d]/g, "");
      if (cnpj.length !== 14) {
        return res.status(400).json({ message: "CNPJ deve ter 14 dígitos" });
      }
      // Try ReceitaWS first
      try {
        const response = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cnpj}`, {
          headers: { 'User-Agent': 'BudgetSales/1.0' },
        });
        if (response.ok) {
          const data = await response.json();
          if ((data as any).status === 'OK') {
            return res.json(data);
          }
        }
      } catch { }
      // Fallback BrasilAPI
      try {
        const resp2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (resp2.ok) {
          const data2 = await resp2.json();
          return res.json(data2);
        }
      } catch { }
      return res.status(404).json({ message: "CNPJ não encontrado" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Suppliers
  app.get("/api/suppliers", async (req, res) => {
    try {
      const items = await storage.getSuppliers();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/suppliers/:id", async (req, res) => {
    try {
      const item = await storage.getSupplier(req.params.id);
      if (!item) return res.status(404).json({ message: "Supplier not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const rawCnpj = (body.cnpj || "").toString();
      const cleanCnpj = (rawCnpj || "").replace(/[^\d]/g, "");

      // Auto-enrich from CNPJ when name is missing or when explicit flag is provided
      if (cleanCnpj.length === 14 && (!body.name || body.__enrichFromCnpj === true)) {
        // Try ReceitaWS first
        let enriched: any | null = null;
        try {
          const r1 = await fetch(`https://www.receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
            headers: { 'User-Agent': 'BudgetSales/1.0' },
          });
          if (r1.ok) {
            const d1: any = await r1.json();
            if (d1 && (d1.status === 'OK' || d1.nome)) {
              enriched = {
                name: d1.nome || undefined,
                tradeName: d1.fantasia || undefined,
                email: d1.email || undefined,
                phone: d1.telefone || undefined,
                // Compose address similarly to frontend logic
                address: [
                  [d1.logradouro || '', d1.numero || ''].filter(Boolean).join(', '),
                  d1.complemento ? `${d1.complemento}` : '',
                  d1.bairro ? `${d1.bairro}` : ''
                ].filter(Boolean).join(' - ') || undefined,
                city: d1.municipio || d1.cidade || undefined,
                state: d1.uf || d1.estado || undefined,
                zipCode: d1.cep || undefined,
              };
            }
          }
        } catch { }

        // Fallback to BrasilAPI
        if (!enriched) {
          try {
            const r2 = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
            if (r2.ok) {
              const d2: any = await r2.json();
              enriched = {
                name: d2.razao_social || d2.razaoSocial || undefined,
                tradeName: d2.nome_fantasia || d2.nomeFantasia || undefined,
                email: d2.email || undefined,
                phone: d2.ddd_telefone_1 || d2.telefone || undefined,
                address: [
                  [d2.logradouro || '', d2.numero || ''].filter(Boolean).join(', '),
                  d2.complemento ? `${d2.complemento}` : '',
                  d2.bairro ? `${d2.bairro}` : ''
                ].filter(Boolean).join(' - ') || undefined,
                city: d2.municipio || d2.cidade || undefined,
                state: d2.uf || d2.estado || undefined,
                zipCode: d2.cep || undefined,
              };
            }
          } catch { }
        }

        if (enriched) {
          // Only fill missing fields; do not override what client sent
          body.name = body.name || enriched.name;
          body.tradeName = body.tradeName ?? enriched.tradeName ?? body.tradeName;
          body.email = body.email ?? enriched.email ?? body.email;
          body.phone = body.phone ?? enriched.phone ?? body.phone;
          body.address = body.address ?? enriched.address ?? body.address;
          body.city = body.city ?? enriched.city ?? body.city;
          body.state = body.state ?? enriched.state ?? body.state;
          body.zipCode = body.zipCode ?? enriched.zipCode ?? body.zipCode;
        }
      }

      const data = insertSupplierSchema.parse(body);
      const created = await storage.createSupplier(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/suppliers/:id", async (req, res) => {
    try {
      const partial = insertSupplierSchema.partial().parse(req.body);
      const updated = await storage.updateSupplier(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/suppliers/:id", async (req, res) => {
    try {
      const ok = await storage.deleteSupplier(req.params.id);
      if (!ok) return res.status(404).json({ message: "Supplier not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Supplier -> Products (helper route)
  app.get("/api/suppliers/:id/products", async (req, res) => {
    try {
      const items = await storage.getProducts();
      const filtered = items.filter(p => (p as any).supplierId === req.params.id);
      res.json(filtered);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Supplier -> Metrics (helper route)
  app.get("/api/suppliers/:id/metrics", async (req, res) => {
    try {
      const items = await storage.getProducts();
      const products = items.filter(p => (p as any).supplierId === req.params.id);
      const toNum = (v: any) => (v == null ? 0 : Number(v));

      const productCount = products.length;
      const totalStock = products.reduce((acc, p: any) => acc + toNum(p.currentStock), 0);
      const stockValueCost = products.reduce((acc, p: any) => acc + toNum(p.currentStock) * toNum(p.costPrice), 0);
      const stockValueSale = products.reduce((acc, p: any) => acc + toNum(p.currentStock) * toNum(p.salePrice), 0);
      const lowStockCount = products.filter((p: any) => p.currentStock != null && p.minimumStock != null && Number(p.currentStock) <= Number(p.minimumStock)).length;
      const outOfStockCount = products.filter((p: any) => toNum(p.currentStock) === 0).length;

      res.json({ productCount, totalStock, stockValueCost, stockValueSale, lowStockCount, outOfStockCount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const items = await storage.getCategories();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const item = await storage.getCategory(req.params.id);
      if (!item) return res.status(404).json({ message: "Category not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const data = insertCategorySchema.parse(req.body);
      const created = await storage.createCategory(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const partial = insertCategorySchema.partial().parse(req.body);
      const updated = await storage.updateCategory(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const ok = await storage.deleteCategory(req.params.id);
      if (!ok) return res.status(404).json({ message: "Category not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Segments
  app.get("/api/segments", async (req, res) => {
    try {
      console.log('[DEBUG] /api/segments - Iniciando requisição');
      console.log('[DEBUG] Environment:', process.env.NODE_ENV);
      console.log('[DEBUG] Vercel:', !!process.env.VERCEL);

      const items = await storage.getSegments();
      console.log('[DEBUG] /api/segments - Retornando', items?.length || 0, 'segmentos');
      res.json(items);
    } catch (error: any) {
      console.error('[ERROR] /api/segments - Erro:', error);
      res.status(500).json({
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  app.get("/api/segments/:id", async (req, res) => {
    try {
      const item = await storage.getSegment(req.params.id);
      if (!item) return res.status(404).json({ message: "Segment not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/segments", async (req, res) => {
    try {
      const data = insertSegmentSchema.parse(req.body);
      const created = await storage.createSegment(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/segments/:id", async (req, res) => {
    try {
      const partial = insertSegmentSchema.partial().parse(req.body);
      const updated = await storage.updateSegment(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/segments/:id", async (req, res) => {
    try {
      const ok = await storage.deleteSegment(req.params.id);
      if (!ok) return res.status(404).json({ message: "Segment not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      console.log('[DEBUG] /api/products - Iniciando requisição');
      console.log('[DEBUG] Environment:', process.env.NODE_ENV);
      console.log('[DEBUG] Vercel:', !!process.env.VERCEL);

      const items = await storage.getProducts();
      const supplierId = (req.query as any).supplierId as string | undefined;
      const filtered = supplierId ? items.filter(p => (p as any).supplierId === supplierId) : items;

      console.log('[DEBUG] /api/products - Retornando', filtered?.length || 0, 'produtos');
      res.json(filtered);
    } catch (error: any) {
      console.error('[ERROR] /api/products - Erro:', error);
      res.status(500).json({
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  app.get("/api/products/low-stock", async (req, res) => {
    try {
      const items = await storage.getLowStockProducts();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Excel template for product import (must be before /api/products/:id)
  app.get("/api/products/import-template", async (_req, res) => {
    try {
      const XLSX = await import('xlsx');
      const headers = [[
        'Produto',
        'Codigo de Barras',
        'Codigo Interno',
        'Estoque Atual',
        'Unidade Medida',
        'Estoque Mínimo',
        'Categoria',
        'Fornecedor',
        'Marca',
        'NCM',
        'Custo Unitário',
        'Preço de Venda',
      ]];
      const ws = XLSX.utils.aoa_to_sheet(headers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'ImportarProdutos');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="template_import_produtos.xlsx"');
      res.send(buf);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Excel import endpoint
  app.post("/api/products/import-excel", upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      const XLSX = await import('xlsx');
      const wb = XLSX.readFile((req.file as any).path);
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const normalize = (s: any) => String(s || '').trim();

      const existingProducts = await storage.getProducts();
      const existingByBarcode = new Map(existingProducts.filter((p: any) => p.barcode).map((p: any) => [p.barcode, p]));
      const existingByName = new Map(existingProducts.map((p: any) => [p.name.toLowerCase(), p]));

      const seenKeys = new Set<string>();

      const [allCategories, allSuppliers] = await Promise.all([
        storage.getCategories(),
        storage.getSuppliers(),
      ]);
      const categoryByName = new Map(allCategories.map((c: any) => [c.name.toLowerCase(), c]));
      const supplierByName = new Map(allSuppliers.map((s: any) => [s.name.toLowerCase(), s]));

      const created: string[] = [];
      const updated: string[] = [];
      const duplicates: Array<{ row: number; reason: string }> = [];
      const errors: Array<{ row: number; message: string }> = [];

      for (let idx = 0; idx < rows.length; idx++) {
        const r = rows[idx];
        const rowNo = idx + 2; // header on line 1
        try {
          const name = normalize(r['Produto']);
          const barcode = normalize(r['Codigo de Barras']);
          const unit = normalize(r['Unidade Medida']) || 'UN';
          const currentStock = Number(String(r['Estoque Atual'] || '0').replace(',', '.')) || 0;
          const minimumStock = Number(String(r['Estoque Mínimo'] || '0').replace(',', '.')) || 0;
          const categoryName = normalize(r['Categoria']);
          const supplierName = normalize(r['Fornecedor']);
          const brand = normalize(r['Marca']);
          const ncm = normalize(r['NCM']);
          const costPrice = String(r['Custo Unitário'] ?? '0').replace('.', '').replace(',', '.');
          const salePrice = String(r['Preço de Venda'] ?? '0').replace('.', '').replace(',', '.');

          if (!name && !barcode) {
            errors.push({ row: rowNo, message: 'Linha sem Produto e sem Código de Barras' });
            continue;
          }

          const duplicateKey = barcode ? `BAR:${barcode}` : `NAME:${name.toLowerCase()}`;
          if (seenKeys.has(duplicateKey)) {
            duplicates.push({ row: rowNo, reason: 'Linha duplicada na planilha' });
            continue;
          }
          seenKeys.add(duplicateKey);

          // Category resolve (create if not exists)
          let categoryId: string | null = null;
          if (categoryName) {
            const found = categoryByName.get(categoryName.toLowerCase());
            if (found) categoryId = found.id; else {
              const createdCat = await storage.createCategory({ name: categoryName, description: null } as any);
              categoryId = createdCat.id;
              categoryByName.set(categoryName.toLowerCase(), createdCat);
            }
          }

          // Supplier resolve (create if not exists)
          let supplierId: string | null = null;
          if (supplierName) {
            const found = supplierByName.get(supplierName.toLowerCase());
            if (found) supplierId = found.id; else {
              const createdSup = await storage.createSupplier({ name: supplierName, cnpj: '', email: null, phone: null, address: null, city: null, state: null, zipCode: null } as any);
              supplierId = createdSup.id;
              supplierByName.set(supplierName.toLowerCase(), createdSup);
            }
          }

          // Find existing by barcode or name
          let existing: any | undefined = undefined;
          if (barcode && existingByBarcode.has(barcode)) existing = existingByBarcode.get(barcode);
          if (!existing && name && existingByName.has(name.toLowerCase())) existing = existingByName.get(name.toLowerCase());

          if (!existing) {
            const createdProd = await storage.createProduct({
              name,
              barcode: barcode || null,
              description: null,
              unit,
              costPrice: costPrice || '0',
              salePrice: salePrice || '0',
              currentStock,
              minimumStock,
              maximumStock: 1000,
              categoryId,
              supplierId,
              isActive: true,
              brand: brand || null,
              ncm: ncm || null,
            } as any);
            created.push(createdProd.id);
            if (barcode) existingByBarcode.set(barcode, createdProd);
            if (name) existingByName.set(name.toLowerCase(), createdProd);
          } else {
            const partial: any = {
              barcode: barcode || existing.barcode || null,
              unit,
              salePrice: salePrice || existing.salePrice,
              currentStock,
              minimumStock,
              categoryId,
              supplierId,
              brand: brand || existing.brand || null,
              ncm: ncm || existing.ncm || null,
            };
            if (String(existing.costPrice) !== String(costPrice)) {
              partial.costPrice = costPrice;
            }
            const updatedProd = await storage.updateProduct(existing.id, partial);
            updated.push(updatedProd.id);
            if (barcode) existingByBarcode.set(barcode, updatedProd);
            if (name) existingByName.set(name.toLowerCase(), updatedProd);
          }
        } catch (err: any) {
          errors.push({ row: rowNo, message: err.message || String(err) });
        }
      }

      res.json({ created, updated, duplicates, errors });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const item = await storage.getProduct(req.params.id);
      if (!item) return res.status(404).json({ message: "Product not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Product price history
  app.get("/api/products/:id/price-history", async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });
      const history = await (storage as any).getProductPriceHistory?.(productId);
      res.json(history || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Product suppliers mapping (supplier code and last price)
  app.get("/api/products/:id/suppliers", async (req, res) => {
    try {
      const productId = req.params.id;
      const product = await storage.getProduct(productId);
      if (!product) return res.status(404).json({ message: "Product not found" });
      const mappings = await (storage as any).getProductSuppliers?.(productId);
      res.json(mappings || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const created = await storage.createProduct(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const partial = insertProductSchema.partial().parse(req.body);
      const updated = await storage.updateProduct(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const ok = await storage.deleteProduct(req.params.id);
      if (!ok) return res.status(404).json({ message: "Product not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Upload product image
  app.post('/api/products/:id/image', productUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });

      const productId = req.params.id;
      const file = req.file;

      const product = await storage.getProduct(productId);
      if (!product) {
        // remove uploaded file
        await fs.unlink(file.path).catch(() => { });
        return res.status(404).json({ message: 'Product not found' });
      }

      const imageUrl = `/uploads/products/${path.basename(file.path)}`;

      const updated = await storage.updateProduct(productId, { ...(product as any), imageUrl } as any);

      res.status(201).json({ imageUrl, product: updated });
    } catch (error: any) {
      if (req.file) {
        await fs.unlink((req.file as any).path).catch(() => { });
      }
      res.status(400).json({ message: error.message });
    }
  });

  // Inventory
  app.get("/api/inventory", async (req, res) => {
    try {
      const items = await storage.getInventoryMovements();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inventory/:id", async (req, res) => {
    try {
      const item = await storage.getInventoryMovement(req.params.id);
      if (!item) return res.status(404).json({ message: "Inventory movement not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inventory/product/:productId", async (req, res) => {
    try {
      const items = await storage.getInventoryMovementsByProduct(req.params.productId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const data = insertInventorySchema.parse(req.body);
      const created = await storage.createInventoryMovement(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const partial = insertInventorySchema.partial().parse(req.body);
      const updated = await storage.updateInventoryMovement(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const ok = await storage.deleteInventoryMovement(req.params.id);
      if (!ok) return res.status(404).json({ message: "Inventory movement not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({
        message: "Erro ao excluir movimento de estoque",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Quotes - list with optional server-side filters and normalized fields
  app.get("/api/quotes", async (req, res) => {
    try {
      const all = await storage.getQuotes();

      // Ensure we always return an array
      const safeQuotes = Array.isArray(all) ? all : [];
      res.json(safeQuotes);
    } catch (error: any) {
      console.error('[ERROR] /api/quotes - Erro:', error);
      // Return empty array as fallback to prevent 500 errors
      res.status(500).json({
        message: "Erro ao carregar orçamentos",
        data: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      // ... (rest of the code remains the same)
      const item = await storage.getSale(req.params.id);
      if (!item) return res.status(404).json({ message: "Sale not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales", async (req: Request, res: Response) => {
    try {
      const bodyData: any = { ...req.body };
      // Normalize date
      if (bodyData.date && typeof bodyData.date === 'string') {
        const d = new Date(bodyData.date);
        if (!isNaN(d.getTime())) bodyData.date = d;
      }
      // If sale comes from PDV, ensure dueDate = now when not provided
      if (typeof bodyData.dueDate === 'undefined' && typeof bodyData.notes === 'string' && bodyData.notes.includes('venda Avulsa PDV')) {
        bodyData.dueDate = new Date();
      }
      if (bodyData.dueDate && typeof bodyData.dueDate === 'string') {
        const dd = new Date(bodyData.dueDate);
        if (!isNaN(dd.getTime())) bodyData.dueDate = dd;
      }
      // Coerce decimal fields to strings and set defaults when missing
      const dec = (v: any) => {
        const n = Number(v);
        return isFinite(n) ? n.toFixed(2) : undefined;
      };
      if (bodyData.subtotal != null) bodyData.subtotal = dec(bodyData.subtotal);
      if (bodyData.discount != null) bodyData.discount = dec(bodyData.discount);
      if (bodyData.total != null) bodyData.total = dec(bodyData.total);
      // Provide safe defaults when omitted (totals may be recalculated later)
      if (bodyData.subtotal == null) bodyData.subtotal = '0.00';
      if (bodyData.discount == null) bodyData.discount = '0.00';
      if (bodyData.total == null) bodyData.total = '0.00';
      // Provide required fields if omitted by client; createSale will overwrite number anyway
      if (!bodyData.number) bodyData.number = 'AUTO';
      if (!bodyData.paymentMethod) bodyData.paymentMethod = 'CASH';

      const data = insertSaleSchema.parse(bodyData);
      const created = await storage.createSale(data);

      // Register cash movement for PDV-originated sales
      try {
        if (typeof bodyData.notes === 'string' && bodyData.notes.includes('venda Avulsa PDV')) {
          const amount = parseFloat(String((created as any).total || '0')) || 0;
          const method = (created as any).paymentMethod || 'UNKNOWN';
          await storage.addCashMovement?.('SALE', amount, `Venda ${created.number} (${method}) - PDV`);
        }
      } catch (e) {
        console.warn('[sales:create] failed to add cash movement:', e);
      }

      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/sales/:id", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const dd = parseDateSafe(body.dueDate);
      if (dd) body.dueDate = dd;
      // Coerce decimal fields to strings when provided as numbers
      if (typeof body.subtotal === 'number') body.subtotal = body.subtotal.toFixed(2);
      if (typeof body.discount === 'number') body.discount = body.discount.toFixed(2);
      if (typeof body.total === 'number') body.total = body.total.toFixed(2);
      const partial = insertSaleSchema.partial().parse(body);
      const before = await storage.getSale(req.params.id);
      const updated = await storage.updateSale(req.params.id, partial);

      // Se o desconto foi alterado, recalcular totais (subtotal/total)
      if (body.discount != null) {
        try {
          await storage.recalculateSaleTotals(updated.id);
        } catch (e) {
          console.warn('Falha ao recalcular totais da venda', updated.id, e);
        }
      }

      // On transition to COMPLETED, ensure receivable exists; on revert, remove OPEN receivable
      try {
        if ((partial as any).status === 'COMPLETED' && (before as any)?.status !== 'COMPLETED') {
          const allFin = await storage.getFinanceEntries();
          const exists = allFin.some((f: any) => f.saleId === updated.id && f.entryType === 'RECEIVABLE');
          if (!exists) {
            const customer = await storage.getCustomer((updated as any).customerId);
            await storage.createFinanceEntry({
              entryType: 'RECEIVABLE' as any,
              status: 'OPEN' as any,
              date: new Date(),
              dueDate: (updated as any).dueDate || new Date(),
              description: `Recebível da venda ${updated.number}`,
              partyName: customer?.name || null as any,
              customerId: (updated as any).customerId as any,
              supplierId: null as any,
              saleId: updated.id as any,
              amount: (updated as any).total as any,
              paidAt: null as any,
              paymentMethod: (updated as any).paymentMethod as any,
              recurrence: null as any,
              category: 'Vendas' as any,
              costCenter: null as any,
              project: null as any,
              notes: (updated as any).notes || null as any,
              linkFinanceId: null as any,
            } as any);
          }
        } else if ((partial as any).status && (partial as any).status !== 'COMPLETED' && (before as any)?.status === 'COMPLETED') {
          // Reverted from COMPLETED -> remove OPEN receivable entries for this sale
          const allFin = await storage.getFinanceEntries();
          const toRemove = allFin.filter((f: any) => f.saleId === updated.id && f.entryType === 'RECEIVABLE' && f.status === 'OPEN');
          for (const fin of toRemove) {
            await storage.deleteFinanceEntry((fin as any).id);
          }
        }
      } catch (e) {
        console.error('ensure receivable failed for sale', req.params.id, e);
      }

      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      const ok = await storage.deleteSale(req.params.id);
      if (!ok) return res.status(404).json({ message: "Sale not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sale Items
  app.get("/api/sales/:id/items", async (req, res) => {
    try {
      const items = await storage.getSaleItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Buscar venda pelo número (ex.: VDA000008)
  app.get("/api/sales/by-number/:number", async (req, res) => {
    try {
      const sale = await storage.getSaleByNumber(req.params.number);
      if (!sale) return res.status(404).json({ message: 'Venda não encontrada' });
      res.json(sale);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/sales/:id/items", async (req, res) => {
    try {
      const raw: any = { ...req.body, saleId: req.params.id };
      // Coerce numeric fields similar to quotes
      if (typeof raw.unitPrice === 'number') raw.unitPrice = raw.unitPrice.toFixed(2);
      if (typeof raw.discount === 'number') raw.discount = raw.discount.toFixed(2);
      if (typeof raw.total === 'number') raw.total = raw.total.toFixed(2);
      if (typeof raw.quantity === 'string') {
        const q = parseInt(raw.quantity, 10);
        if (!Number.isNaN(q)) raw.quantity = q;
      }
      // Compute total if missing
      if ((raw.total == null || raw.total === '') && raw.unitPrice != null && raw.quantity != null) {
        const unit = Number(raw.unitPrice);
        const qty = Number(raw.quantity);
        const disc = raw.discount != null ? Number(raw.discount) : 0;
        raw.total = (unit * qty - disc).toFixed(2);
      }
      const data = insertSaleItemSchema.parse(raw);
      const created = await storage.createSaleItem(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Copy items from linked quote into an existing sale (backfill for old sales)
  app.post("/api/sales/:id/copy-items-from-quote", async (req, res) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) return res.status(404).json({ message: 'Venda não encontrada' });
      if (!sale.quoteId) return res.status(400).json({ message: 'Esta venda não está vinculada a um orçamento' });

      const existing = await storage.getSaleItems(sale.id);
      if (existing.length > 0) return res.status(400).json({ message: 'A venda já possui itens' });

      const qItems = await storage.getQuoteItems(sale.quoteId);
      for (const qi of qItems) {
        await storage.createSaleItem({
          saleId: sale.id,
          productId: qi.productId ?? undefined,
          serviceDescription: qi.serviceDescription ?? undefined,
          quantity: qi.quantity,
          unitPrice: qi.unitPrice,
          discount: qi.discount ?? '0',
          total: qi.total,
        });
      }
      const items = await storage.getSaleItems(sale.id);
      res.status(201).json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Atualizar itens de uma venda
  app.put("/api/sales/:id/items", async (req, res) => {
    try {
      const saleId = req.params.id;
      const { items } = req.body as { items: any[] };

      // Verificar se a venda existe
      const sale = await storage.getSale(saleId);
      if (!sale) return res.status(404).json({ message: 'Venda não encontrada' });

      // Obter itens atuais da venda
      const currentItems = await storage.getSaleItems(saleId);

      // Processar cada item da requisição
      for (const item of items) {
        if (item.id && item.id.startsWith('temp-')) {
          // É um novo item, remover o ID temporário
          const { id, ...newItem } = item;
          // Coerce numeric fields
          if (typeof newItem.unitPrice === 'number') newItem.unitPrice = newItem.unitPrice.toFixed(2);
          if (typeof newItem.discount === 'number') newItem.discount = newItem.discount.toFixed(2);
          if (typeof newItem.total === 'number') newItem.total = newItem.total.toFixed(2);
          if (typeof newItem.quantity === 'string') {
            const q = parseInt(newItem.quantity, 10);
            if (!Number.isNaN(q)) newItem.quantity = q;
          }

          // Validar presença de produto ou descrição de serviço
          if (!newItem.productId && !newItem.serviceDescription) {
            return res.status(400).json({ message: 'Informe um produto ou uma descrição de serviço.' });
          }

          // Criar novo item
          await storage.createSaleItem({
            ...newItem,
            saleId
          });
        } else if (item.id) {
          // É um item existente, verificar se ainda existe na lista atual
          const existingItem = currentItems.find(ci => ci.id === item.id);
          if (existingItem) {
            // Atualizar item existente
            const { id, ...updateData } = item;
            // Coerce numeric fields
            if (typeof updateData.unitPrice === 'number') updateData.unitPrice = updateData.unitPrice.toFixed(2);
            if (typeof updateData.discount === 'number') updateData.discount = updateData.discount.toFixed(2);
            if (typeof updateData.total === 'number') updateData.total = updateData.total.toFixed(2);
            if (typeof updateData.quantity === 'string') {
              const q = parseInt(updateData.quantity, 10);
              if (!Number.isNaN(q)) updateData.quantity = q;
            }

            await storage.updateSaleItem(id, updateData);
          }
        }
      }

      // Remover itens que não estão mais na lista
      const newItemIds = items.filter((item: any) => !item.id.startsWith('temp-')).map((item: any) => item.id);
      for (const currentItem of currentItems) {
        if (!newItemIds.includes(currentItem.id)) {
          await storage.deleteSaleItem(currentItem.id);
        }
      }

      // Retornar itens atualizados
      const updatedItems = await storage.getSaleItems(saleId);
      res.json(updatedItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sale items list (used by dashboard/products page)
  app.get("/api/sale-items", async (_req, res) => {
    try {
      const list = await (storage as any).getSaleItems?.();
      if (list) return res.json(list);
      // Fallback: derive from sales when storage doesn't expose getSaleItems
      const sales = await storage.getSales();
      const items = (sales || []).flatMap((s: any) => (s.items || []).map((it: any) => ({ ...it, saleId: s.id })));
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/sale-items/:id", async (req, res) => {
    try {
      const partial = insertSaleItemSchema.partial().parse(req.body);
      const updated = await storage.updateSaleItem(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  // Update persisted service cost override for a sale item (service items only)
  app.put("/api/sale-items/:id/service-cost", async (req, res) => {
    try {
      const id = req.params.id;
      const valueRaw = (req.body as any)?.serviceCost;
      // Hard-lock: once persisted (>0), do not allow further edits via this endpoint
      try {
        const saleItem = await storage.getSaleItemById?.(id);
        const currentPersisted = saleItem ? Number((saleItem as any).serviceCost || 0) : 0;
        if (currentPersisted > 0) {
          return res.status(409).json({ message: 'Custo de serviço já consolidado para este item.' });
        }
      } catch { }
      // Allow null to clear
      if (valueRaw === null) {
        return res.status(409).json({ message: 'Não é permitido limpar custo de serviço consolidado.' });
      }
      const n = typeof valueRaw === 'string' ? Number(valueRaw) : Number(valueRaw ?? 0);
      if (!isFinite(n) || n < 0) {
        return res.status(400).json({ message: 'serviceCost inválido' });
      }
      const payload: any = { serviceCost: n.toFixed(2) };
      const updated = await storage.updateSaleItem(id, payload);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/sale-items/:id", async (req, res) => {
    try {
      const ok = await storage.deleteSaleItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Sale item not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cash Register Routes
  app.get("/api/cash-register/current", async (req, res) => {
    try {
      const register = await storage.getCurrentCashRegister?.();
      res.json(register || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cash-register/movements/:registerId?", async (req, res) => {
    try {
      const registerId = req.params.registerId || req.query.registerId;
      const movements = await storage.getCashMovements?.(registerId as string);
      res.json(movements || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cash-register/open", async (req, res) => {
    try {
      const { openingBalance } = req.body;
      const register = await storage.openCashRegister?.(parseFloat(openingBalance || "0"));
      res.json(register);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cash-register/close", async (req, res) => {
    try {
      const { closingBalance } = req.body;
      const register = await storage.closeCashRegister?.(parseFloat(closingBalance || "0"));
      res.json(register);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/cash-register/movement", async (req, res) => {
    try {
      const { type, amount, description } = req.body;
      const movement = await storage.addCashMovement?.(type, parseFloat(amount || "0"), description);
      res.json(movement);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cash Register History Endpoints
  app.get("/api/cash-register/registers", async (_req, res) => {
    try {
      const registers = await storage.listCashRegisters?.();
      res.json(registers || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cash-register/registers/:id", async (req, res) => {
    try {
      const reg = await storage.getCashRegisterById?.(req.params.id);
      if (!reg) return res.status(404).json({ message: "Caixa não encontrado" });
      res.json(reg);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cash-register/registers/:id/history", async (req, res) => {
    try {
      const reg = await storage.getCashRegisterById?.(req.params.id);
      if (!reg) return res.status(404).json({ message: "Caixa não encontrado" });

      const start = new Date(reg.openedAt as any);
      const end = reg.closedAt ? new Date(reg.closedAt as any) : new Date();

      const [movements, finance] = await Promise.all([
        storage.getCashMovements?.(reg.id) || Promise.resolve([]),
        storage.getFinanceEntriesInPeriod?.(start, end) || Promise.resolve([]),
      ]);

      res.json({ register: reg, period: { start, end }, movements, finance });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Quotes - list with optional server-side filters and normalized fields
  app.get("/api/quotes", async (req, res) => {
    try {
      const all = await storage.getQuotes();

      // Parse common query params used by the client filters
      const {
        q: searchTerm,
        status,
        customerId,
        expiredOnly,
        validFrom,
        validTo,
        createdFrom,
        createdTo,
        totalMin,
        totalMax,
      } = req.query as Record<string, string | undefined>;

      // Helper to parse booleans
      const parseBool = (v?: string) => v === '1' || v === 'true';

      // Normalize every quote to a predictable shape and compute total including shipping/tax
      const normalize = (q: any) => {
        const subtotalNum = q.subtotal != null ? Number(q.subtotal) : 0;
        const discountNum = q.discount != null ? Number(q.discount) : 0;
        const taxNum = (q as any).taxTotal != null ? Number((q as any).taxTotal) : 0;
        const shippingNum = (q as any).shipping != null ? Number((q as any).shipping) : 0;
        const computedTotal = (subtotalNum - discountNum + taxNum + shippingNum).toFixed(2);
        return {
          ...q,
          subtotal: subtotalNum.toFixed(2),
          discount: discountNum.toFixed(2),
          total: computedTotal,
          taxTotal: taxNum.toFixed(2),
          shipping: shippingNum.toFixed(2),
          validUntil: q.validUntil ? (new Date(q.validUntil)).toISOString() : null,
          createdAt: q.createdAt ? (new Date(q.createdAt)).toISOString() : null,
        };
      };

      let list = (all || []).map(normalize);

      // Server-side full-text / simple search (number, notes, customer name requires client to join data)
      if (searchTerm) {
        const term = (searchTerm || '').toLowerCase();
        list = list.filter((qq: any) => {
          return (qq.number || '').toLowerCase().includes(term) ||
            (qq.notes || '').toLowerCase().includes(term);
        });
      }

      if (status) {
        list = list.filter((qq: any) => qq.status === status);
      }

      if (customerId) {
        list = list.filter((qq: any) => qq.customerId === customerId);
      }

      if (parseBool(expiredOnly)) {
        list = list.filter((qq: any) => {
          if (!qq.validUntil) return false;
          return new Date(qq.validUntil) < new Date();
        });
      }

      if (validFrom || validTo) {
        list = list.filter((qq: any) => {
          if (!qq.validUntil) return false;
          const vu = new Date(qq.validUntil);
          if (validFrom && vu < new Date(validFrom)) return false;
          if (validTo) {
            const end = new Date(validTo);
            end.setHours(23, 59, 59, 999);
            if (vu > end) return false;
          }
          return true;
        });
      }

      if (createdFrom || createdTo) {
        list = list.filter((qq: any) => {
          if (!qq.createdAt) return false;
          const c = new Date(qq.createdAt);
          if (createdFrom && c < new Date(createdFrom)) return false;
          if (createdTo) {
            const end = new Date(createdTo);
            end.setHours(23, 59, 59, 999);
            if (c > end) return false;
          }
          return true;
        });
      }

      if (totalMin || totalMax) {
        list = list.filter((qq: any) => {
          const total = Number(qq.total ?? 0);
          const min = totalMin ? Number((totalMin || '').replace(',', '.')) : undefined;
          const max = totalMax ? Number((totalMax || '').replace(',', '.')) : undefined;
          if (min !== undefined && !isNaN(min) && total < min) return false;
          if (max !== undefined && !isNaN(max) && total > max) return false;
          return true;
        });
      }

      res.json(list);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || String(e) });
    }
  });

  app.get("/api/quotes/by-number/:number", async (req, res) => {
    try {
      const item = await storage.getQuoteByNumber(req.params.number);
      if (!item) return res.status(404).json({ message: "Quote not found" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || String(e) });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const item = await storage.getQuote(req.params.id);
      if (!item) return res.status(404).json({ message: "Quote not found" });
      res.json(item);
    } catch (e: any) {
      res.status(500).json({ message: e?.message || String(e) });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const vd = parseDateSafe(body.validUntil);
      if (vd) body.validUntil = vd;
      const data = insertQuoteSchema.parse(body);
      const created = await storage.createQuote(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/quotes/:id", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const vd = parseDateSafe(body.validUntil);
      if (vd) body.validUntil = vd;
      const partial = insertQuoteSchema.partial().parse(body);
      const updated = await storage.updateQuote(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/quotes/:id", async (req, res) => {
    try {
      const ok = await storage.deleteQuote(req.params.id);
      if (!ok) return res.status(404).json({ message: "Quote not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Quote Items
  app.get("/api/quotes/:id/items", async (req, res) => {
    try {
      const items = await storage.getQuoteItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/quotes/:id/items", async (req, res) => {
    try {
      const raw: any = { ...req.body, quoteId: req.params.id };
      // Coerce numeric fields: decimals expect strings; quantity expects integer
      if (typeof raw.unitPrice === 'number') raw.unitPrice = raw.unitPrice.toString();
      if (typeof raw.discount === 'number') raw.discount = raw.discount.toString();
      if (typeof raw.total === 'number') raw.total = raw.total.toString();
      if (typeof raw.quantity === 'string') {
        const q = parseInt(raw.quantity, 10);
        if (!Number.isNaN(q)) raw.quantity = q;
      }
      // Validate presence of either product or service description
      if (!raw.productId && !raw.serviceDescription) {
        return res.status(400).json({ message: 'Informe um produto ou uma descrição de serviço.' });
      }
      // Compute total if missing and possible
      if ((raw.total == null || raw.total === '') && raw.unitPrice != null && raw.quantity != null) {
        const unit = Number(raw.unitPrice);
        const qty = Number(raw.quantity);
        const disc = raw.discount != null ? Number(raw.discount) : 0;
        const tot = (unit * qty) - disc;
        raw.total = isFinite(tot) ? tot.toFixed(2) : '0.00';
      }
      const data = insertQuoteItemSchema.parse(raw);
      const created = await storage.createQuoteItem(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Quote Attachments
  app.get("/api/quotes/:id/attachments", async (req, res) => {
    try {
      const attachments = await storage.getQuoteAttachments(req.params.id);
      res.json(attachments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/quotes/:id/attachments",
    upload.single('file'),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: 'Nenhum arquivo enviado' });
        }

        const quoteId = req.params.id;
        const file = req.file;

        // Verificar se o orçamento existe
        const quote = await storage.getQuote(quoteId);
        if (!quote) {
          // Remover o arquivo enviado se o orçamento não existir
          await fs.unlink(file.path).catch(console.error);
          return res.status(404).json({ message: 'Orçamento não encontrado' });
        }

        const attachment = await storage.addQuoteAttachment({
          quoteId,
          fileName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          filePath: file.path,
          uploadedBy: req.user?.id,
        });

        res.status(201).json(attachment);
      } catch (error: any) {
        // Remover o arquivo em caso de erro
        if (req.file) {
          await fs.unlink(req.file.path).catch(console.error);
        }
        res.status(400).json({ message: error.message });
      }
    }
  );

  app.delete("/api/quote-attachments/:id", async (req, res) => {
    try {
      const attachment = await storage.getQuoteAttachment(req.params.id);
      if (!attachment) {
        return res.status(404).json({ message: 'Anexo não encontrado' });
      }

      // Verificar se o usuário tem permissão para excluir (opcional)
      // if (attachment.uploadedBy !== req.user?.id) {
      //   return res.status(403).json({ message: 'Sem permissão para excluir este anexo' });
      // }

      // Remover o arquivo do sistema de arquivos
      try {
        await fs.unlink(attachment.filePath);
      } catch (error) {
        console.error('Erro ao remover arquivo físico:', error);
        // Continuar mesmo se não conseguir remover o arquivo físico
      }

      // Remover o registro do banco de dados
      await storage.deleteQuoteAttachment(attachment.id);

      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/quote-items/:id", async (req, res) => {
    try {
      const raw: any = { ...req.body };
      // Coerce numeric fields like in POST
      if (typeof raw.unitPrice === 'number') raw.unitPrice = raw.unitPrice.toString();
      if (typeof raw.discount === 'number') raw.discount = raw.discount.toString();
      if (typeof raw.total === 'number') raw.total = raw.total.toString();
      if (typeof raw.quantity === 'string') {
        const q = parseInt(raw.quantity, 10);
        if (!Number.isNaN(q)) raw.quantity = q;
      }
      // If both productId and serviceDescription are explicitly set to empty in update, reject
      if ('productId' in raw && !raw.productId && 'serviceDescription' in raw && !raw.serviceDescription) {
        return res.status(400).json({ message: 'Informe um produto ou uma descrição de serviço.' });
      }
      // Compute total if possible and not provided
      if ((raw.total == null || raw.total === '') && raw.unitPrice != null && raw.quantity != null) {
        const unit = Number(raw.unitPrice);
        const qty = Number(raw.quantity);
        const disc = raw.discount != null ? Number(raw.discount) : 0;
        const tot = (unit * qty) - disc;
        raw.total = isFinite(tot) ? tot.toFixed(2) : '0.00';
      }
      const partial = insertQuoteItemSchema.partial().parse(raw);
      const updated = await storage.updateQuoteItem(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/quote-items/:id", async (req, res) => {
    try {
      const ok = await storage.deleteQuoteItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Quote item not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Aliases to support nested quote item routes used by the client
  app.put("/api/quotes/:quoteId/items/:id", async (req, res) => {
    try {
      const raw: any = { ...req.body };
      if (typeof raw.unitPrice === 'number') raw.unitPrice = raw.unitPrice.toString();
      if (typeof raw.discount === 'number') raw.discount = raw.discount.toString();
      if (typeof raw.total === 'number') raw.total = raw.total.toString();
      if (typeof raw.quantity === 'string') {
        const q = parseInt(raw.quantity, 10);
        if (!Number.isNaN(q)) raw.quantity = q;
      }
      if ('productId' in raw && !raw.productId && 'serviceDescription' in raw && !raw.serviceDescription) {
        return res.status(400).json({ message: 'Informe um produto ou uma descrição de serviço.' });
      }
      if ((raw.total == null || raw.total === '') && raw.unitPrice != null && raw.quantity != null) {
        const unit = Number(raw.unitPrice);
        const qty = Number(raw.quantity);
        const disc = raw.discount != null ? Number(raw.discount) : 0;
        const tot = (unit * qty) - disc;
        raw.total = isFinite(tot) ? tot.toFixed(2) : '0.00';
      }
      const partial = insertQuoteItemSchema.partial().parse(raw);
      const updated = await storage.updateQuoteItem(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/quotes/:quoteId/items/:id", async (req, res) => {
    try {
      const ok = await storage.deleteQuoteItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Quote item not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Purchase Requests
  app.get("/api/purchase-requests", async (req, res) => {
    try {
      const items = await storage.getPurchaseRequests();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/purchase-requests/:id", async (req, res) => {
    try {
      const item = await storage.getPurchaseRequest(req.params.id);
      if (!item) return res.status(404).json({ message: "Purchase request not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchase-requests", async (req, res) => {
    try {
      // Ensure a sequential number exists (e.g., PRQ000001)
      const body = { ...req.body } as any;
      if (!body.number || typeof body.number !== 'string' || body.number.trim() === '') {
        const existing = await storage.getPurchaseRequests();
        const prefix = 'PRQ';
        const pad = 6;
        const maxNum = existing
          .map(r => (r as any).number as string)
          .filter(n => typeof n === 'string' && n.startsWith(prefix))
          .map(n => parseInt(n.slice(prefix.length), 10))
          .filter(v => !isNaN(v))
          .reduce((a, b) => Math.max(a, b), 0);
        const next = (maxNum + 1).toString().padStart(pad, '0');
        body.number = `${prefix}${next}`;
      }
      if (!body.status) body.status = 'DRAFT';

      const data = insertPurchaseRequestSchema.parse(body);
      const created = await storage.createPurchaseRequest(data as any);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/purchase-requests/:id", async (req, res) => {
    try {
      const partial = insertPurchaseRequestSchema.partial().parse(req.body);
      const updated = await storage.updatePurchaseRequest(req.params.id, partial as any);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  // Items for a purchase request
  app.get("/api/purchase-requests/:id/items", async (req, res) => {
    try {
      const items = await storage.getPurchaseRequestItems(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/purchase-requests/:id/items", async (req, res) => {
    try {
      // Coerce types to satisfy Zod schema (decimals expect strings, quantity expects integer)
      const raw: any = { ...req.body, requestId: req.params.id };
      if (typeof raw.unitPrice === 'number') raw.unitPrice = raw.unitPrice.toString();
      if (typeof raw.total === 'number') raw.total = raw.total.toString();
      if (typeof raw.quantity === 'string') {
        const q = parseInt(raw.quantity, 10);
        if (!Number.isNaN(q)) raw.quantity = q;
      }
      const data = insertPurchaseRequestItemSchema.parse(raw);
      const created = await storage.addPurchaseRequestItem(data as any);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/purchase-request-items/:id", async (req, res) => {
    try {
      // Coerce numeric fields similar to POST handler
      const raw: any = { ...req.body };
      if (typeof raw.unitPrice === 'number') raw.unitPrice = raw.unitPrice.toString();
      if (typeof raw.total === 'number') raw.total = raw.total.toString();
      if (typeof raw.quantity === 'string') {
        const q = parseInt(raw.quantity, 10);
        if (!Number.isNaN(q)) raw.quantity = q;
      }
      // Validate partial updates
      const partial = insertPurchaseRequestItemSchema.partial().parse(raw);
      const updated = await storage.updatePurchaseRequestItem(req.params.id, partial as any);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/purchase-request-items/:id", async (req, res) => {
    try {
      const ok = await storage.removePurchaseRequestItem(req.params.id);
      if (!ok) return res.status(404).json({ message: "Purchase request item not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Status transitions
  app.post("/api/purchase-requests/:id/status", async (req, res) => {
    try {
      const status = (req.body?.status as string) as 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
      if (!status || !['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }
      const updated = await storage.setPurchaseRequestStatus(req.params.id, status);

      // On approval, auto-create products for free-text items
      if (status === 'APPROVED') {
        try {
          const pr = await storage.getPurchaseRequest(req.params.id);
          const items = await storage.getPurchaseRequestItems(req.params.id);
          const supplierId = (pr as any)?.supplierId || null;

          // Prepare a code generator for products (e.g., PRD000001)
          const existingProducts = await storage.getProducts();
          const prefix = 'PRD';
          const pad = 6;
          const maxNum = existingProducts
            .map((p: any) => p.code as string)
            .filter((code: any) => typeof code === 'string' && code.startsWith(prefix))
            .map((code: string) => parseInt(code.slice(prefix.length), 10))
            .filter((n) => !Number.isNaN(n))
            .reduce((a, b) => Math.max(a, b), 0);
          let nextNum = maxNum + 1;

          for (const it of items) {
            if (!it.productId && (it as any).description) {
              const desc = (it as any).description as string;
              const unitPrice = (it as any).unitPrice ?? '0';
              const code = `${prefix}${String(nextNum).padStart(pad, '0')}`;
              nextNum += 1;

              // Create minimal product
              const productPayload: any = {
                code,
                name: desc.substring(0, 100) || 'Produto',
                description: desc,
                supplierId,
                unit: 'UN',
                costPrice: (typeof unitPrice === 'number' ? unitPrice.toString() : unitPrice) || '0',
                salePrice: (typeof unitPrice === 'number' ? unitPrice.toString() : unitPrice) || '0',
                currentStock: 0,
                minimumStock: 0,
                maximumStock: 1000,
                isActive: true,
              };
              const createdProduct = await storage.createProduct(productPayload);

              // Update item to link created product and clear free-text description
              await storage.updatePurchaseRequestItem((it as any).id, { productId: (createdProduct as any).id, description: null } as any);
            }
          }
        } catch (e: any) {
          // Do not fail the status transition if auto-creation fails; just log and continue
          console.error('Auto product creation failed for PR approval:', e?.message || e);
        }
      }

      res.json(updated);
    } catch (error: any) {
      const code = error.message?.includes('not found') ? 404 : 400;
      res.status(code).json({ message: error.message });
    }
  });

  // Finance
  app.get("/api/finance", async (req, res) => {
    try {
      console.log('/api/finance: Endpoint chamado');
      const items = await storage.getFinanceEntries();
      console.log('/api/finance: Retornando', items.length, 'registros');

      // Ensure we always return an array
      const safeItems = Array.isArray(items) ? items : [];
      res.json(safeItems);
    } catch (error: any) {
      console.error('/api/finance: Erro:', error);
      // Return empty array as fallback to prevent 500 errors
      res.status(500).json({
        message: "Erro ao carregar dados financeiros",
        data: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.get("/api/finance/:id", async (req, res) => {
    try {
      const item = await storage.getFinanceEntry(req.params.id);
      if (!item) return res.status(404).json({ message: "Finance entry not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reports - Profit Analysis
  app.get("/api/reports/profit", async (req, res) => {
    try {
      const q = req.query as any;
      const start = parseDateSafe(q.start);
      const end = parseDateSafe(q.end);
      const customerId = (q.customerId || '').toString() || undefined;
      const projectId = (q.projectId || '').toString() || undefined;
      const productId = (q.productId || '').toString() || undefined;
      const serviceCostMode = (q.serviceCostMode || 'expenses') as 'expenses' | 'tasks' | 'hybrid';
      const hourlyRate = Number(q.hourlyRate || 0) || 0;
      const groupBy = (q.groupBy || 'none') as 'none' | 'sale' | 'customer' | 'project' | 'product' | 'type';

      const withinRange = (d?: any) => {
        if (!d) return true;
        const dt = parseDateSafe(d);
        if (!dt) return true;
        if (start && dt < start) return false;
        if (end) {
          // end inclusive by day (till 23:59:59)
          const e = new Date(end);
          e.setHours(23, 59, 59, 999);
          if (dt > e) return false;
        }
        return true;
      };

      const toNum = (v: any) => {
        if (v == null) return 0;
        const n = Number(v);
        return isFinite(n) ? n : 0;
      };

      // Load base datasets
      const [allSales, allProducts, allCustomers] = await Promise.all([
        storage.getSales(),
        storage.getProducts(),
        storage.getCustomers(),
      ]);
      const productMap = new Map(allProducts.map((p: any) => [p.id, p]));
      const customerMap = new Map(allCustomers.map((c: any) => [c.id, c]));

      // Filter sales
      const sales = allSales.filter((s: any) => {
        if (!withinRange((s as any).createdAt)) return false;
        if (customerId && customerId !== 'all' && (s as any).customerId !== customerId) return false;
        if (projectId && projectId !== 'all' && (s as any).projectId !== projectId) return false;
        return true;
      });

      // Build detailed items
      const items: any[] = [];

      // Preload sale items per sale for efficiency
      for (const sale of sales) {
        const saleItems = await storage.getSaleItems((sale as any).id);

        // Optional item-level filter by product
        const filteredItems = saleItems.filter((it: any) => {
          if (productId && productId !== 'all') {
            return (it as any).productId === productId;
          }
          return true;
        });

        // Compute sums for proportional allocation
        const lineSubtotal = (it: any) => toNum(it.unitPrice) * toNum(it.quantity) - toNum(it.discount);
        const linesSum = filteredItems.reduce((acc, it: any) => acc + Math.max(0, lineSubtotal(it)), 0);
        const saleDiscount = toNum((sale as any).discount);

        // Identify service items for later allocation
        const serviceItems = filteredItems.filter((it: any) => !(it as any).productId && !!(it as any).serviceDescription);
        const productItems = filteredItems.filter((it: any) => !!(it as any).productId);

        // Pre-compute service revenue basis for allocation
        const serviceRevenueSum = serviceItems.reduce((acc, it: any) => acc + Math.max(0, lineSubtotal(it)), 0);

        // Compute project-level service costs to allocate (if any)
        let projectExpensesTotal = 0;
        let projectTasksTotal = 0;
        const saleProjectId = (sale as any).projectId as string | null;
        if (saleProjectId) {
          if (serviceCostMode === 'expenses' || serviceCostMode === 'hybrid') {
            const expenses = await storage.getProjectExpenses(saleProjectId);
            // Filter by date window
            const expFiltered = expenses.filter((e: any) => withinRange(e.date));
            projectExpensesTotal = expFiltered.reduce((acc: number, e: any) => acc + toNum(e.amount), 0);
          }
          if (serviceCostMode === 'tasks' || serviceCostMode === 'hybrid') {
            const tasks = await storage.getProjectTasks(saleProjectId);
            const tFiltered = tasks.filter((t: any) => withinRange(t.createdAt));
            projectTasksTotal = tFiltered.reduce((acc: number, t: any) => acc + (toNum(t.actualHours) * hourlyRate) + toNum(t.cost), 0);
          }
        }

        // We'll also accumulate expenses directly linked to a specific sale item to avoid double-allocation
        const directExpenseBySaleItem = new Map<string, number>();
        if (saleProjectId && (serviceCostMode === 'expenses' || serviceCostMode === 'hybrid')) {
          const expenses = await storage.getProjectExpenses(saleProjectId);
          const expFiltered = expenses.filter((e: any) => withinRange(e.date));
          for (const e of expFiltered) {
            const sid = (e as any).linkedSaleItemId as string | undefined;
            if (sid) directExpenseBySaleItem.set(sid, (directExpenseBySaleItem.get(sid) || 0) + toNum((e as any).amount));
          }
          // Remove direct-linked expenses from pool to avoid double-counting in allocation
          const directTotal = Array.from(directExpenseBySaleItem.values()).reduce((a, b) => a + b, 0);
          projectExpensesTotal = Math.max(0, projectExpensesTotal - directTotal);
        }

        for (const it of filteredItems) {
          const isProduct = !!(it as any).productId;
          const qty = toNum((it as any).quantity);
          const unit = toNum((it as any).unitPrice);
          const itemDisc = toNum((it as any).discount);
          const gross = unit * qty; // before discounts
          const baseForAllocation = Math.max(0, gross - itemDisc);
          const allocated = linesSum > 0 ? (saleDiscount * (baseForAllocation / linesSum)) : 0;
          const netRevenue = Math.max(0, gross - itemDisc - allocated);

          let cost = 0;
          let productIdVal: string | undefined = (it as any).productId || undefined;
          let description = (it as any).serviceDescription || '';
          let persistedServiceCost = false;
          if (isProduct && productIdVal) {
            const prod = productMap.get(productIdVal);
            const costPrice = toNum((prod as any)?.costPrice);
            cost = costPrice * qty;
            description = (prod as any)?.name || description || 'Produto';
          } else {
            // Service cost allocation
            // If persisted service_cost exists, prefer it; otherwise compute allocation
            const persisted = toNum((it as any).serviceCost);
            let serviceCost = persisted > 0 ? persisted : 0;
            if (persisted > 0) persistedServiceCost = true;
            const saleItemId = (it as any).id as string;
            if (!(persisted > 0)) {
              // Only compute if not persisted
              // Direct-linked expenses first
              const direct = directExpenseBySaleItem.get(saleItemId) || 0;
              serviceCost += direct;
              // Allocate remaining project pools proportionally by service revenue
              if (serviceRevenueSum > 0) {
                const share = baseForAllocation / serviceRevenueSum;
                if (serviceCostMode === 'expenses' || serviceCostMode === 'hybrid') {
                  serviceCost += projectExpensesTotal * share;
                }
                if (serviceCostMode === 'tasks' || serviceCostMode === 'hybrid') {
                  serviceCost += projectTasksTotal * share;
                }
              }
            }
            cost = serviceCost;
            if (!description) description = 'Serviço';
          }

          const profit = netRevenue - cost;
          const margin = netRevenue > 0 ? profit / netRevenue : 0;

          items.push({
            id: (it as any).id,
            saleId: (sale as any).id,
            saleNumber: (sale as any).number,
            saleDate: (sale as any).createdAt,
            customerId: (sale as any).customerId,
            customerName: customerMap.get((sale as any).customerId)?.name,
            projectId: (sale as any).projectId ?? null,
            projectName: undefined,
            type: isProduct ? 'product' : 'service',
            itemDescription: description,
            quantity: qty,
            unitPrice: unit,
            itemDiscount: itemDisc,
            allocatedDiscount: allocated,
            grossRevenue: gross,
            netRevenue,
            cost,
            profit,
            margin,
            productId: productIdVal ?? null,
            ...(isProduct ? {} : { persistedServiceCost }),
          });
        }
      }

      // Totals
      const totals = items.reduce((acc, it) => {
        acc.revenue += toNum(it.netRevenue);
        acc.cost += toNum(it.cost);
        acc.profit += toNum(it.profit);
        return acc;
      }, { revenue: 0, cost: 0, profit: 0 });
      const margin = totals.revenue > 0 ? totals.profit / totals.revenue : 0;

      // Optional grouping
      let groups: any[] | undefined = undefined;
      if (groupBy && groupBy !== 'none') {
        const groupKey = (it: any): { key: string; label: string } => {
          switch (groupBy) {
            case 'sale': return { key: it.saleId, label: it.saleNumber || it.saleId };
            case 'customer': return { key: it.customerId || 'sem-cliente', label: it.customerName || it.customerId || 'Sem cliente' };
            case 'project': return { key: it.projectId || 'sem-projeto', label: it.projectName || it.projectId || 'Sem projeto' };
            case 'product': return { key: it.productId || 'servico', label: it.productId ? (productMap.get(it.productId as any) as any)?.name || 'Produto' : 'Serviço' };
            case 'type': return { key: it.type, label: it.type === 'product' ? 'Produto' : 'Serviço' };
            default: return { key: 'all', label: 'Todos' };
          }
        };
        const map = new Map<string, { key: string; label: string; revenue: number; cost: number; profit: number }>();
        for (const it of items) {
          const g = groupKey(it);
          const cur = map.get(g.key) || { key: g.key, label: g.label, revenue: 0, cost: 0, profit: 0 };
          cur.revenue += toNum(it.netRevenue);
          cur.cost += toNum(it.cost);
          cur.profit += toNum(it.profit);
          map.set(g.key, cur);
        }
        groups = Array.from(map.values()).map(g => ({ ...g, margin: g.revenue > 0 ? g.profit / g.revenue : 0 }));
      }

      res.json({
        items,
        totals: { revenue: totals.revenue, cost: totals.cost, profit: totals.profit, margin },
        ...(groups ? { groups } : {}),
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance", async (req, res) => {
    try {
      console.log('/api/finance POST: Recebido payload:', req.body);
      const body: any = { ...req.body };
      const d = parseDateSafe(body.date);
      const dd = parseDateSafe(body.dueDate);
      const pd = parseDateSafe(body.paidAt);
      if (d) body.date = d;
      if (dd) body.dueDate = dd;
      if (pd) body.paidAt = pd;
      console.log('/api/finance POST: Payload após parse de datas:', body);
      // Coerce numeric fields that may arrive as localized strings or empty strings
      const coerceNumber = (val: any) => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
          const s = val.trim();
          if (s === '') return null;
          // handle Brazilian style 1.234,56 -> 1234.56 and plain 1234.56
          const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
          const n = parseFloat(normalized);
          return Number.isFinite(n) ? n : null;
        }
        return null;
      };

      // Ensure amount is numeric (not empty). discount/surcharge can be null.
      body.amount = coerceNumber(body.amount) ?? body.amount;
      body.discount = coerceNumber(body.discount);
      body.surcharge = coerceNumber(body.surcharge);
      console.log('/api/finance POST: Payload após coerceNumber:', body);
      let data;
      try {
        data = insertFinanceSchema.parse(body);
        console.log('/api/finance POST: Dados validados:', data);
      } catch (validationError: any) {
        console.error('/api/finance POST: Erro de validação:', validationError.message);
        console.error('/api/finance POST: Detalhes do erro:', validationError);
        return res.status(400).json({ message: validationError.message });
      }
      const created = await storage.createFinanceEntry(data);

      // Se for uma conta a pagar (PAYABLE) vinculada a um projeto, criar despesa automaticamente
      if (created.entryType === 'PAYABLE' && created.project) {
        try {
          const project = await storage.getProject(created.project);
          if (project && project.status !== 'concluido') {
            // Criar despesa no projeto
            const expenseData = {
              projectId: created.project,
              description: `${created.description || 'Despesa financeira'} [FIN:${created.id}]`,
              date: new Date(created.date),
              amount: created.amount,
              status: created.status === 'PAID' ? 'COMPLETED' : 'OPEN',
              category: created.category || 'Geral',
              supplierId: created.supplierId || null,
            };

            await storage.createProjectExpense(expenseData);
            console.log(`Despesa criada automaticamente no projeto ${created.project} para lançamento ${created.id}`);
          }
        } catch (expenseError) {
          console.error('Erro ao criar despesa no projeto:', expenseError);
          // Não falhar a criação do lançamento se houver erro na despesa
        }
      }

      res.status(201).json(created);
    } catch (error: any) {
      console.error('/api/finance POST: Erro:', error);
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/finance/:id", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const d = parseDateSafe(body.date);
      const dd = parseDateSafe(body.dueDate);
      const pd = parseDateSafe(body.paidAt);
      if (d) body.date = d;
      if (dd) body.dueDate = dd;
      if (pd) body.paidAt = pd;
      const partial = insertFinanceSchema.partial().parse(body);
      const updated = await storage.updateFinanceEntry(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/finance/:id", async (req, res) => {
    try {
      const ok = await storage.deleteFinanceEntry(req.params.id);
      if (!ok) return res.status(404).json({ message: "Finance entry not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/:id/mark-paid", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const d = parseDateSafe(body.date);
      if (d) body.date = d;
      const result = await storage.markPaidWithCashMovement(req.params.id, {
        date: body.date || new Date(),
        paymentMethod: body.paymentMethod ?? null,
        notes: body.notes ?? null,
      });
      res.json(result);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  // Alias: some clients call /pay instead of /mark-paid
  app.post("/api/finance/:id/pay", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const d = parseDateSafe(body.date);
      if (d) body.date = d;

      // Buscar o lançamento antes de marcar como pago
      const financeEntry = await storage.getFinanceEntry(req.params.id);

      const result = await storage.markPaidWithCashMovement(req.params.id, {
        date: body.date || new Date(),
        paymentMethod: body.paymentMethod ?? null,
        notes: body.notes ?? null,
      });

      // Se for uma conta a pagar vinculada a um projeto, atualizar a despesa
      if (financeEntry && financeEntry.entryType === 'PAYABLE' && financeEntry.project) {
        try {
          // Buscar despesas do projeto que estão vinculadas a este lançamento (pela tag [FIN:id])
          const projectExpenses = await storage.getProjectExpenses(financeEntry.project);
          const financeTag = `[FIN:${financeEntry.id}]`;
          const linkedExpense = projectExpenses.find((exp: any) =>
            exp.description && exp.description.includes(financeTag)
          );

          if (linkedExpense) {
            // Atualizar a despesa para status concluído
            await storage.updateProjectExpense(linkedExpense.id, {
              status: 'COMPLETED',
            });
            console.log(`Despesa ${linkedExpense.id} do projeto ${financeEntry.project} atualizada como paga`);
          }
        } catch (expenseError) {
          console.error('Erro ao atualizar despesa do projeto:', expenseError);
          // Não falhar o pagamento se houver erro na atualização da despesa
        }
      }

      res.json(result);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  // Marcar lançamento como concluído
  app.post("/api/finance/:id/mark-completed", async (req, res) => {
    try {
      console.log("Rota mark-completed chamada", req.params);
      // Verificar se o lançamento existe
      const entry = await storage.getFinanceEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Lançamento não encontrado" });
      }

      const updated = await storage.updateFinanceEntry(req.params.id, { status: 'COMPLETED' as any });
      res.json(updated);
    } catch (error: any) {
      console.error("Erro ao marcar lançamento como concluído:", error);
      const status = (error.message?.includes('not found')) ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  // Projects
  app.get("/api/projects", async (req, res) => {
    try {
      const items = await storage.getProjects();
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/projects/:id", async (req, res) => {
    try {
      const item = await storage.getProject(req.params.id);
      if (!item) return res.status(404).json({ message: "Project not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const sd = parseDateSafe(body.startDate);
      const eed = parseDateSafe(body.expectedEndDate);
      const ed = parseDateSafe(body.endDate);
      if (sd) body.startDate = sd;
      if (eed) body.expectedEndDate = eed;
      if (ed) body.endDate = ed;
      // Consistência: se houver quoteId, sincronizar/validar customerId
      if (body.quoteId) {
        const q = await storage.getQuote(body.quoteId);
        if (!q) return res.status(400).json({ message: "Orçamento (quote) não encontrado" });
        if (!body.customerId) body.customerId = q.customerId;
        if (body.customerId && q.customerId && body.customerId !== q.customerId) {
          return res.status(400).json({ message: "Customer do projeto difere do customer do orçamento vinculado" });
        }
      }
      const data = insertProjectSchema.parse(body);
      const created = await storage.createProject(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/projects/:id", async (req, res) => {
    try {
      const body: any = { ...req.body };
      const sd = parseDateSafe(body.startDate);
      const eed = parseDateSafe(body.expectedEndDate);
      const ed = parseDateSafe(body.endDate);
      if (sd) body.startDate = sd;
      if (eed) body.expectedEndDate = eed;
      if (ed) body.endDate = ed;
      // Consistência entre quoteId e customerId
      if (body.quoteId) {
        const q = await storage.getQuote(body.quoteId);
        if (!q) return res.status(400).json({ message: "Orçamento (quote) não encontrado" });
        if (!body.customerId) body.customerId = q.customerId;
        if (body.customerId && q.customerId && body.customerId !== q.customerId) {
          return res.status(400).json({ message: "Customer do projeto difere do customer do orçamento vinculado" });
        }
      }
      const partial = insertProjectSchema.partial().parse(body);
      const updated = await storage.updateProject(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = (error.message?.includes('not found')) ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const ok = await storage.deleteProject(req.params.id);
      if (!ok) return res.status(404).json({ message: "Project not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Project Tasks
  app.get("/api/projects/:id/tasks", async (req, res) => {
    try {
      const items = await storage.getProjectTasks(req.params.id);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/tasks", async (req, res) => {
    try {
      // Verificar se o projeto está concluído
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
      }
      if (project.status === "COMPLETED") {
        return res.status(400).json({ message: "Não é possível adicionar tarefas a um projeto concluído" });
      }

      const body: any = { ...req.body, projectId: req.params.id };
      const sd = parseDateSafe(body.startDate);
      const dd = parseDateSafe(body.dueDate);
      if (sd) body.startDate = sd;
      if (dd) body.dueDate = dd;
      const data = insertProjectTaskSchema.parse(body);
      const created = await storage.createProjectTask(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/projects/:projectId/tasks/:taskId", async (req, res) => {
    try {
      // Verificar se o projeto está concluído
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
      }
      if (project.status === "COMPLETED") {
        return res.status(400).json({ message: "Não é possível editar tarefas de um projeto concluído" });
      }

      const body: any = { ...req.body };
      const sd = parseDateSafe(body.startDate);
      const dd = parseDateSafe(body.dueDate);
      if (sd) body.startDate = sd;
      if (dd) body.dueDate = dd;
      const partial = insertProjectTaskSchema.partial().omit({ projectId: true }).parse(body);
      const updated = await storage.updateProjectTask(req.params.taskId, partial);
      res.json(updated);
    } catch (error: any) {
      const status = (error.message?.includes('not found')) ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:projectId/tasks/:taskId", async (req, res) => {
    try {
      const ok = await storage.deleteProjectTask(req.params.taskId);
      if (!ok) return res.status(404).json({ message: "Project task not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Project Expenses
  app.get("/api/projects/:id/expenses", async (req, res) => {
    try {
      const items = await storage.getProjectExpenses(req.params.id);
      // Enrich with linked quote/sale item details when available
      const enriched = await Promise.all(items.map(async (e: any) => {
        const out: any = { ...e };
        if (e.linkedQuoteItemId) {
          const qi = await (storage as any).getQuoteItemById?.(e.linkedQuoteItemId);
          if (qi) {
            const q = await storage.getQuote(qi.quoteId);
            out.linkedInfo = {
              type: 'QUOTE',
              itemId: qi.id,
              sourceId: qi.quoteId,
              sourceNumber: q?.number || null,
              name: qi.productId ? `Produto ${qi.productId}` : (qi.serviceDescription || 'Serviço'),
              quantity: qi.quantity,
              unitPrice: qi.unitPrice,
              total: qi.total,
            };
          }
        } else if (e.linkedSaleItemId) {
          const si = await (storage as any).getSaleItemById?.(e.linkedSaleItemId);
          if (si) {
            const s = await storage.getSale(si.saleId);
            out.linkedInfo = {
              type: 'SALE',
              itemId: si.id,
              sourceId: si.saleId,
              sourceNumber: s?.number || null,
              name: si.productId ? `Produto ${si.productId}` : (si.serviceDescription || 'Serviço'),
              quantity: si.quantity,
              unitPrice: si.unitPrice,
              total: si.total,
            };
          }
        }
        return out;
      }));
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/projects/:id/expenses", async (req, res) => {
    try {
      // Verificar se o projeto está concluído
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
      }
      if (project.status === "COMPLETED") {
        return res.status(400).json({ message: "Não é possível adicionar despesas a um projeto concluído" });
      }

      const body: any = { ...req.body, projectId: req.params.id };
      // Support optional productId and quantity to launch expense from stock.
      const productId = body.productId;
      const quantity = body.quantity ? Number(body.quantity) : undefined;
      // remove inventory-specific fields before validating expense payload
      delete body.productId;
      delete body.quantity;

      const d = parseDateSafe(body.date);
      if (d) body.date = d;
      const data = insertProjectExpenseSchema.parse(body);
      const created = await storage.createProjectExpense(data);

      // If a productId + quantity was provided, create an inventory OUT movement
      // This ensures stock is decremented and movement is recorded atomically after expense creation.
      if (productId && quantity && quantity > 0) {
        try {
          await storage.createInventoryMovement({
            productId: String(productId),
            type: 'OUT',
            quantity: Math.floor(quantity),
            reason: `Despesa projeto ${req.params.id}: ${String(data.description || '')}`,
            userId: null,
          } as any);
        } catch (invErr: any) {
          // Log the inventory error but still return created expense; client can reconcile.
          console.error('Erro ao criar movimento de inventário:', invErr?.message || invErr);
        }
      }

      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/projects/:projectId/expenses/:expenseId", async (req, res) => {
    try {
      // Verificar se o projeto está concluído
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
      }
      if (project.status === "COMPLETED") {
        return res.status(400).json({ message: "Não é possível editar despesas de um projeto concluído" });
      }

      const body: any = { ...req.body };
      const d = parseDateSafe(body.date);
      if (d) body.date = d;
      const partial = insertProjectExpenseSchema.partial().omit({ projectId: true }).parse(body);
      const updated = await storage.updateProjectExpense(req.params.expenseId, partial);
      res.json(updated);
    } catch (error: any) {
      const status = (error.message?.includes('not found')) ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/projects/:projectId/expenses/:expenseId", async (req, res) => {
    try {
      // Verificar se o projeto está concluído
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
      }
      if (project.status === "COMPLETED") {
        return res.status(400).json({ message: "Não é possível excluir despesas de um projeto concluído" });
      }

      const ok = await storage.deleteProjectExpense(req.params.expenseId);
      if (!ok) return res.status(404).json({ message: "Project expense not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Marcar despesa como concluída
  app.post("/api/projects/:projectId/expenses/:expenseId/mark-completed", async (req, res) => {
    try {
      console.log("Rota mark-completed chamada", req.params);
      // Verificar se o projeto está concluído
      const project = await storage.getProject(req.params.projectId);
      if (!project) {
        return res.status(404).json({ message: "Projeto não encontrado" });
      }
      if (project.status === "COMPLETED") {
        return res.status(400).json({ message: "Não é possível modificar despesas de um projeto concluído" });
      }

      const updated = await storage.updateProjectExpense(req.params.expenseId, { status: "COMPLETED" });
      res.json(updated);
    } catch (error: any) {
      console.error("Erro ao marcar despesa como concluída:", error);
      const status = (error.message?.includes('not found')) ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  // Project Summary (budget/cost aggregation)
  app.get("/api/projects/:id/summary", async (req, res) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) return res.status(404).json({ message: "Project not found" });

      // Quote total: preferir quoteId do projeto; senão, procurar por quote com projectId
      let quoteTotal = 0;
      if ((project as any).quoteId) {
        const q = await storage.getQuote((project as any).quoteId);
        if (q?.total) quoteTotal = Number(q.total);
      } else {
        // fallback: procurar orçamento vinculado ao projeto
        if ((storage as any).getQuotes) {
          const allQuotes = await (storage as any).getQuotes();
          const q = (allQuotes || []).find((qq: any) => qq.projectId === project.id);
          if (q?.total) quoteTotal = Number(q.total);
        }
      }

      // Somatórios
      const tasks = await storage.getProjectTasks(project.id);
      const tasksCost = (tasks || []).reduce((acc: number, t: any) => acc + Number(t.cost || 0), 0);
      const expenses = await storage.getProjectExpenses(project.id);
      const expensesTotal = (expenses || []).reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0);

      const projectBudget = Number((project as any).budget || 0);
      const totalPlanned = quoteTotal > 0 ? quoteTotal : projectBudget;
      const totalActual = tasksCost + expensesTotal;
      const remaining = (totalPlanned || 0) - totalActual;

      res.json({
        projectId: project.id,
        customerId: (project as any).customerId || null,
        status: (project as any).status,
        quoteId: (project as any).quoteId || null,
        budget: projectBudget,
        quoteTotal,
        tasksCost,
        expensesTotal,
        totalPlanned,
        totalActual,
        remaining,
        counts: {
          tasks: tasks?.length || 0,
          expenses: expenses?.length || 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Project Documents (Attachments)
  // List documents for a project
  app.get("/api/projects/:id/documents", async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const docs = await (storage as any).getProjectDocuments(projectId);
      res.json(docs || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Falha ao listar anexos' });
    }
  });

  // Upload a new document with optional caption (title)
  app.post("/api/projects/:id/documents", projectUpload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Nenhum arquivo enviado' });
      const projectId = req.params.id;
      const caption = (req.body?.caption || req.body?.title || req.file.originalname || '').toString();
      const relUrl = `/uploads/projects/${projectId}/${req.file.filename}`;
      const mimetype = req.file.mimetype || 'application/octet-stream';

      const created = await (storage as any).createProjectDocument({
        projectId,
        title: caption || req.file.originalname,
        url: relUrl,
        type: mimetype as any,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao enviar anexo' });
    }
  });

  // Create a document record pointing to a remote URL (Drive or external)
  app.post('/api/projects/:id/documents/remote', async (req: Request, res: Response) => {
    try {
      const projectId = req.params.id;
      const { title, url, type } = req.body as { title?: string; url?: string; type?: string };
      if (!url) return res.status(400).json({ message: 'Missing url' });
      const created = await (storage as any).createProjectDocument({ projectId, title: title || url.split('/').pop(), url, type });
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Falha ao criar anexo remoto' });
    }
  });

  // Google Drive integration endpoints (optional)
  if (process.env.ENABLE_GOOGLE_DRIVE === 'true') {
    // Return an authorization URL to start OAuth flow
    app.get('/api/_drive/auth-url', async (req: Request, res: Response) => {
      try {
        const state = req.query.state as string | undefined;
        const url = googleDrive.generateAuthUrl(state);
        res.json({ url });
      } catch (err: any) {
        res.status(500).json({ message: err.message || 'Drive not configured' });
      }
    });

    // OAuth2 callback exchange (server must be configured with GOOGLE_REDIRECT_URI)
    app.get('/api/_drive/callback', async (req: Request, res: Response) => {
      try {
        const code = req.query.code as string | undefined;
        if (!code) return res.status(400).send('Missing code');
        const tokens = await googleDrive.getTokenFromCode(code);
        // In a real app you should persist tokens securely (DB or secret store)
        res.json({ tokens });
      } catch (err: any) {
        res.status(500).json({ message: err.message || 'Failed to exchange code' });
      }
    });

    // Proxy upload: accept file upload and forward to Drive using provided tokens
    app.post('/api/_drive/upload', upload.single('file'), async (req: Request, res: Response) => {
      try {
        if (!req.file) return res.status(400).json({ message: 'No file' });
        const tokens = req.body.tokens ? JSON.parse(req.body.tokens) : null;
        if (!tokens) return res.status(400).json({ message: 'Missing tokens' });
        const filePath = (req.file as any).path;
        const fileName = req.body.filename || req.file.originalname;
        const mimeType = req.file.mimetype;
        const uploaded = await googleDrive.uploadFileToDrive(tokens, filePath, fileName, mimeType);
        res.json({ uploaded });
      } catch (err: any) {
        res.status(500).json({ message: err.message || 'Drive upload failed' });
      }
    });
  }

  // Delete a project document
  app.delete("/api/projects/:id/documents/:docId", async (req: Request, res: Response) => {
    try {
      const { id: projectId, docId } = req.params as any;
      // Try to delete DB record first
      const ok = await (storage as any).deleteProjectDocument(docId);
      if (!ok) return res.status(404).json({ message: 'Anexo não encontrado' });
      // Optionally, try to remove the file from disk if path is under uploads
      try {
        // We don't have the URL here; client can ignore leftover files, or we could fetch the doc first if necessary.
      } catch { }
      res.status(204).send();
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message || 'Falha ao excluir anexo' });
    }
  });


  // Contracts (older definitions removed in favor of guarded versions later)

  app.delete("/api/contract-documents/:id", async (req, res) => {
    try {
      const ok = await storage.deleteContractDocument(req.params.id);
      if (!ok) return res.status(404).json({ message: "Contract document not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Repair inventory for a specific sale (by number or id)
  app.post("/api/sales/repair-inventory", async (req, res) => {
    try {
      const { number, id } = req.body || {};
      if (!number && !id) {
        return res.status(400).json({ message: "Informe 'number' (ex: VDA000002) ou 'id' da venda" });
      }

      // Resolve sale by id or number
      let sale = undefined as Awaited<ReturnType<typeof storage.getSale>> | undefined;
      if (id) {
        sale = await storage.getSale(id);
      } else if (number) {
        const allSales = await storage.getSales();
        sale = allSales.find((s: any) => s.number === String(number));
      }

      if (!sale) {
        return res.status(404).json({ message: "Venda não encontrada" });
      }

      const items = await storage.getSaleItems(sale.id);
      let createdMovements = 0;
      let checkedItems = 0;

      for (const it of items) {
        if (!it.productId) continue; // serviços não afetam estoque
        checkedItems++;
        const movements = await storage.getInventoryMovementsByProduct(it.productId);
        const expectedReason = `Venda: ${sale.id}`;
        const exists = movements.some((m: any) => m.type === 'OUT' && m.reason === expectedReason);
        if (!exists) {
          await storage.createInventoryMovement({
            productId: it.productId,
            type: 'OUT',
            quantity: it.quantity,
            reason: expectedReason,
            userId: null,
          } as any);
          createdMovements++;
        }
      }

      res.json({
        saleId: sale.id,
        saleNumber: sale.number,
        checkedItems,
        createdMovements,
        repaired: createdMovements > 0,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Ensure receivable exists for a sale by id or number
  app.post("/api/sales/ensure-receivable", async (req, res) => {
    try {
      const { id, number } = req.body || {};
      if (!id && !number) {
        return res.status(400).json({ message: "Informe 'number' (ex: VDA000003) ou 'id' da venda" });
      }

      let sale = undefined as Awaited<ReturnType<typeof storage.getSale>> | undefined;
      if (id) {
        sale = await storage.getSale(id);
      } else if (number) {
        const allSales = await storage.getSales();
        sale = allSales.find((s: any) => s.number === String(number));
      }
      if (!sale) return res.status(404).json({ message: 'Venda não encontrada' });

      if (sale.status !== 'COMPLETED') {
        return res.status(409).json({
          message: 'Venda não está CONCLUÍDA; finalize primeiro.',
          errorCode: 'SALE_NOT_COMPLETED'
        });
      }

      const allFin = await storage.getFinanceEntries();
      const exists = allFin.some((f: any) => f.saleId === sale.id && f.entryType === 'RECEIVABLE');
      if (exists) {
        return res.json({ ensured: true, alreadyExisted: true, saleId: sale.id });
      }

      const customer = await storage.getCustomer(sale.customerId);
      const created = await storage.createFinanceEntry({
        entryType: 'RECEIVABLE' as any,
        status: 'OPEN' as any,
        date: new Date(),
        dueDate: (sale as any).dueDate || new Date(),
        description: `Recebível da venda ${sale.number}`,
        partyName: customer?.name || null as any,
        customerId: sale.customerId as any,
        supplierId: null as any,
        saleId: sale.id as any,
        amount: sale.total as any,
        paidAt: null as any,
        paymentMethod: (sale as any).paymentMethod as any,
        recurrence: null as any,
        category: 'Vendas' as any,
        costCenter: null as any,
        project: null as any,
        notes: (sale as any).notes || null as any,
        linkFinanceId: null as any,
      } as any);

      res.json({ ensured: true, alreadyExisted: false, financeId: (created as any).id, saleId: sale.id });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Ensure receivables for all COMPLETED sales
  app.post("/api/sales/ensure-receivables-bulk", async (_req, res) => {
    try {
      const allSales = await storage.getSales();
      const completed = allSales.filter((s: any) => s.status === 'COMPLETED');
      const allFin = await storage.getFinanceEntries();
      const existingBySaleId = new Set(
        allFin.filter((f: any) => f.entryType === 'RECEIVABLE').map((f: any) => f.saleId)
      );

      let createdCount = 0;
      const createdIds: string[] = [];
      for (const sale of completed) {
        if (existingBySaleId.has((sale as any).id)) continue;
        const customer = await storage.getCustomer((sale as any).customerId);

        const created = await storage.createFinanceEntry({
          entryType: 'RECEIVABLE' as any,
          status: 'OPEN' as any,
          date: new Date(),
          dueDate: (sale as any).dueDate || new Date(),
          description: `Recebível da venda ${sale.number}`,
          partyName: customer?.name || null as any,
          customerId: (sale as any).customerId as any,
          supplierId: null as any,
          saleId: (sale as any).id as any,
          amount: (sale as any).total as any,
          paidAt: null as any,
          paymentMethod: (sale as any).paymentMethod as any,
          recurrence: null as any,
          category: 'Vendas' as any,
          costCenter: null as any,
          project: null as any,
          notes: (sale as any).notes || null as any,
          linkFinanceId: null as any,
        } as any);
        createdCount++;
        createdIds.push((created as any).id);
      }

      res.json({ totalCompleted: completed.length, createdCount, createdIds });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Company settings
  app.get("/api/company", async (_req: Request, res: Response) => {
    try {
      const settings = await storage.getCompanySettings();
      if (!settings) return res.status(404).json({ message: "Nenhum dado cadastrado" });
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/company", async (req: Request, res: Response) => {
    try {
      // require at least cnpj and name
      const body = insertCompanySettingsSchema.partial().parse(req.body);
      if (!body.cnpj || !body.name) {
        return res.status(400).json({ message: "Informe ao menos cnpj e name" });
      }
      const saved = await storage.upsertCompanySettings(body as any);
      res.json(saved);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Upload de logo
  const logoUpload = multer({ storage: multer.memoryStorage() });
  app.post("/api/company/logo", logoUpload.single('logo'), async (req: Request, res: Response) => {
    try {
      const file = (req as any).file as { buffer: Buffer, originalname?: string } | undefined;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

      const fs = await import('fs');
      const path = await import('path');
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const ext = (file.originalname && path.extname(file.originalname)) || '.png';
      const filename = `logo_${Date.now()}${ext}`;
      const fullPath = path.join(uploadsDir, filename);
      await fs.promises.writeFile(fullPath, file.buffer);

      const logoUrl = `/uploads/${filename}`;

      const existing = await storage.getCompanySettings();
      if (existing) {
        await storage.upsertCompanySettings({ ...existing, logoUrl } as any);
      }

      res.status(201).json({ logoUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // XML Import Routes
  const uploadXml = multer({ storage: multer.memoryStorage() });

  // Parse NFe XML
  app.post("/api/xml/parse-nfe", uploadXml.single('xmlFile'), async (req, res) => {
    try {
      const file = (req as any).file as { buffer: Buffer } | undefined;
      if (!file) {
        return res.status(400).json({ message: "Nenhum arquivo XML fornecido" });
      }

      // Validar tamanho do arquivo
      if (file.buffer.length > 10 * 1024 * 1024) { // 10MB
        return res.status(400).json({ message: "Arquivo XML muito grande. Máximo 10MB." });
      }

      const xmlContent = file.buffer.toString('utf-8');

      // Validações básicas do XML
      if (!xmlContent.includes('<?xml') && !xmlContent.includes('<nfeProc') && !xmlContent.includes('<NFe')) {
        return res.status(400).json({
          message: "Arquivo não parece ser um XML válido de NFe",
          details: "O arquivo deve conter tags XML válidas e estrutura de NFe"
        });
      }

      console.log('[XML Import] Iniciando processamento do XML...');
      const nfeData = await parseNFEXML(xmlContent);
      console.log('[XML Import] XML processado com sucesso:', {
        supplier: nfeData.supplier?.name,
        productsCount: nfeData.products?.length,
        nfeNumber: nfeData.nfeNumber
      });

      res.json(nfeData);
    } catch (error: any) {
      console.error('[XML Import] Erro detalhado ao processar XML:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });

      // Mensagens de erro mais específicas
      let userMessage = 'Erro ao processar XML da NFe';
      if (error.message.includes('não é uma NFe válida')) {
        userMessage = 'O arquivo não é uma NFe válida. Verifique se é um XML de Nota Fiscal Eletrônica.';
      } else if (error.message.includes('Dados do emitente não encontrados')) {
        userMessage = 'Dados do fornecedor não encontrados no XML. Verifique se o arquivo está completo.';
      } else if (error.message.includes('Nenhum produto válido encontrado')) {
        userMessage = 'Nenhum produto válido encontrado no XML. Verifique se os produtos têm código, nome e quantidade.';
      } else if (error.message.includes('Formato inválido')) {
        userMessage = 'Formato do XML inválido. Verifique se o arquivo não está corrompido.';
      }

      res.status(400).json({
        message: userMessage,
        technicalDetails: error.message,
        errorCode: 'XML_PARSE_ERROR'
      });
    }
  });

  // Import products from NFe
  app.post("/api/xml/import-products", async (req, res) => {
    try {
      const { supplier, products, nfeNumber } = req.body;

      if (!supplier || !products || !Array.isArray(products)) {
        return res.status(400).json({ message: "Dados inválidos para importação" });
      }

      // Prevenir importação duplicada baseada em CNPJ + número da NFe (quando disponível)
      const cleanCnpj = supplier.cnpj?.replace(/[^\d]/g, '') || '';
      const importKey = nfeNumber ? `${cleanCnpj}-${nfeNumber}` : null;

      if (importKey) {
        try {
          const movements = await storage.getInventoryMovements();
          const alreadyImported = movements.some((m: any) => m.reason?.includes(importKey));
          if (alreadyImported) {
            return res.status(409).json({
              message: "Este XML já foi importado anteriormente.",
              duplicate: true,
              importKey,
            });
          }
        } catch (e) {
          // Em caso de falha na checagem, continuar sem bloquear, mas registrar log
          console.warn('Falha ao checar duplicidade de importação:', e);
        }
      }

      let supplierId = null;
      let supplierCreated = false;

      // Verificar se o fornecedor já existe pelo CNPJ
      const existingSuppliers = await storage.getSuppliers();
      const existingSupplier = existingSuppliers.find((s: any) =>
        s.cnpj && s.cnpj.replace(/[^\d]/g, '') === supplier.cnpj.replace(/[^\d]/g, '')
      );

      if (existingSupplier) {
        supplierId = existingSupplier.id;
      } else {
        // Criar novo fornecedor
        const newSupplier = await storage.createSupplier({
          name: supplier.name,
          cnpj: supplier.cnpj,
          email: supplier.email || null,
          phone: supplier.phone || null,
          address: supplier.address || null,
          city: supplier.city || null,
          state: supplier.state || null,
          zipCode: supplier.zipCode || null
        });
        supplierId = newSupplier.id;
        supplierCreated = true;
      }

      // Obter códigos de produtos existentes para evitar duplicatas
      const existingProducts = await storage.getProducts();
      const existingCodes = existingProducts.map((p: any) => p.code);

      let productsImported = 0;

      // Importar cada produto
      for (const product of products) {
        try {
          // Validações mais robustas do produto
          if (!product.cProd || !product.xProd) {
            console.warn(`[XML Import] Produto ignorado - código ou nome ausente:`, product);
            continue;
          }

          if (!product.qCom || product.qCom <= 0) {
            console.warn(`[XML Import] Produto ignorado - quantidade inválida:`, product);
            continue;
          }

          if (!product.vUnCom || product.vUnCom <= 0) {
            console.warn(`[XML Import] Produto ignorado - preço unitário inválido:`, product);
            continue;
          }

          // Gerar código único se necessário
          let productCode = product.cProd;
          let counter = 1;
          while (existingCodes.includes(productCode)) {
            productCode = `${product.cProd}-${counter}`;
            counter++;
          }

          console.log(`[XML Import] Importando produto: ${product.xProd} (${productCode})`);

          const productData = {
            code: productCode,
            name: product.name,
            description: product.description || `${product.xProd} - NCM: ${product.NCM || 'N/A'}`,
            costPrice: product.costPrice.toString(),
            salePrice: product.salePrice.toString(),
            currentStock: 0, // Estoque inicial zero, será atualizado pelo movimento de entrada
            minimumStock: product.minimumStock || 0,
            categoryId: product.categoryId || null,
            supplierId: supplierId,
            isActive: true
          };

          const created = await storage.createProduct(productData);
          console.log(`[XML Import] Produto criado com sucesso: ${created.id} (${created.code})`);
          // Vincular código do fornecedor (cProd) e último preço para compra rápida
          try {
            if (supplierId) {
              await (storage as any).upsertProductSupplierMapping?.(created.id, supplierId, {
                supplierCode: product.cProd || null,
                lastPrice: (product.vUnCom != null ? String(product.vUnCom) : (product.costPrice != null ? String(product.costPrice) : null)),
                lastPurchasedAt: new Date(),
              });
            }
          } catch (mapErr) {
            console.warn(`[XML Import] Falha ao mapear produto-fornecedor para ${created.code}:`, mapErr);
          }

          // Registrar movimento de ENTRADA no estoque para o produto
          const qty = (product.currentStock && Number(product.currentStock) > 0)
            ? Number(product.currentStock)
            : (product.qCom ? Number(product.qCom) : 0);
          if (qty > 0) {
            const reasonPrefix = importKey ? `Entrada via NFe ${importKey}` : `Entrada via NFe`;
            const reason = `${reasonPrefix} - cProd ${product.cProd}`;
            try {
              await storage.createInventoryMovement({
                productId: created.id,
                type: 'IN',
                quantity: qty,
                reason,
                userId: null,
              } as any);
              console.log(`[XML Import] Movimento de estoque registrado: ${qty} unidades para produto ${created.code}`);
            } catch (invErr) {
              console.error(`[XML Import] Erro ao registrar entrada de estoque para ${product.name || product.xProd}:`, invErr);
            }
          }
          existingCodes.push(productCode); // Adicionar à lista para evitar duplicatas na mesma importação
          productsImported++;
        } catch (error: any) {
          console.error(`[XML Import] Erro ao importar produto ${product.name || product.xProd}:`, {
            error: error.message,
            product: product,
            timestamp: new Date().toISOString()
          });
          // Continuar com os outros produtos mesmo se um falhar
        }
      }

      res.json({
        success: true,
        productsImported,
        supplierCreated,
        supplierId
      });
    } catch (error: any) {
      console.error('Erro na importação:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Contracts
  app.get("/api/contracts", async (_req, res) => {
    try {
      const items = await (storage as any).getContracts?.();
      res.json(items || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/contracts/:id", async (req, res) => {
    try {
      const item = await (storage as any).getContract?.(req.params.id);
      if (!item) return res.status(404).json({ message: "Contract not found" });
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contracts", adminOnly, async (req, res) => {
    try {
      const body: any = { ...req.body };
      const sd = parseDateSafe(body.startDate);
      const ed = parseDateSafe(body.endDate);
      const cd = parseDateSafe(body.cancelDate);
      if (sd) body.startDate = sd;
      if (ed) body.endDate = ed;
      if (cd) body.cancelDate = cd;
      // Enforce at least one party (customer or supplier)
      if (!body.customerId && !body.supplierId) {
        return res.status(400).json({ message: "Informe cliente ou fornecedor para o contrato" });
      }
      const data = insertContractSchema.parse(body);
      const created = await (storage as any).createContract?.(data);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/contracts/:id", adminOnly, async (req, res) => {
    try {
      const body: any = { ...req.body };
      const sd = parseDateSafe(body.startDate);
      const ed = parseDateSafe(body.endDate);
      const cd = parseDateSafe(body.cancelDate);
      if (sd) body.startDate = sd;
      if (ed) body.endDate = ed;
      if (cd) body.cancelDate = cd;
      if (!body.customerId && !body.supplierId) {
        return res.status(400).json({ message: "Informe cliente ou fornecedor para o contrato" });
      }
      const partial = insertContractSchema.partial().parse(body);
      const updated = await (storage as any).updateContract?.(req.params.id, partial);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/contracts/:id", adminOnly, async (req, res) => {
    try {
      const ok = await (storage as any).deleteContract?.(req.params.id);
      if (!ok) return res.status(404).json({ message: "Contract not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Contract Documents
  app.get("/api/contracts/:id/documents", async (req, res) => {
    try {
      const items = await (storage as any).getContractDocuments?.(req.params.id);
      res.json(items || []);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/contracts/:id/documents", adminOnly, async (req, res) => {
    try {
      const data = insertContractDocumentSchema.parse({ ...req.body });
      const created = await (storage as any).addContractDocument?.({
        ...(data as any),
        contractId: req.params.id,
      });
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/contract-documents/:id", adminOnly, async (req, res) => {
    try {
      const ok = await (storage as any).deleteContractDocument?.(req.params.id);
      if (!ok) return res.status(404).json({ message: "Contract document not found" });
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notes
  app.get("/api/notes", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const notes = await storage.getNotes(userId);
      res.json(notes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/notes/:id", async (req, res) => {
    try {
      const note = await storage.getNote(req.params.id);
      if (!note) {
        return res.status(404).json({ message: "Note not found" });
      }
      res.json(note);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const noteData = insertNoteSchema.parse({
        ...req.body,
        userId: userId
      });
      const note = await storage.createNote(noteData);
      res.status(201).json(note);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.put("/api/notes/:id", async (req, res) => {
    try {
      const noteData = insertNoteSchema.partial().parse(req.body);
      const note = await storage.updateNote(req.params.id, noteData);
      res.json(note);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      const success = await storage.deleteNote(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Nota não encontrada" });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Project Observations (using notes table)
  // List observations for a project
  app.get("/api/projects/:id/observations", async (req, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.headers["x-user-id"] as string;
      // Get all notes for the user and filter by project prefix
      const allNotes = await storage.getNotes(userId);
      const projectObservations = allNotes.filter(note =>
        note.title.startsWith(`Projeto: ${projectId}`) ||
        note.title.startsWith(`Projeto ${projectId}:`)
      );
      res.json(projectObservations);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Falha ao listar observações' });
    }
  });

  // Create a new observation for a project
  app.post("/api/projects/:id/observations", async (req, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.headers["x-user-id"] as string;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Conteúdo da observação é obrigatório' });
      }

      const title = `Projeto: ${projectId}`;
      const noteData = insertNoteSchema.parse({
        title,
        content: content.trim(),
        userId: userId,
        color: 'bg-blue-50',
        isPinned: false
      });

      const created = await storage.createNote(noteData);
      res.status(201).json(created);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao criar observação' });
    }
  });

  // Update a project observation
  app.put("/api/projects/:id/observations/:obsId", async (req, res) => {
    try {
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: 'Conteúdo da observação é obrigatório' });
      }

      const noteData = insertNoteSchema.partial().parse({
        content: content.trim()
      });

      const updated = await storage.updateNote(req.params.obsId, noteData);
      res.json(updated);
    } catch (error: any) {
      const status = error.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ message: error.message || 'Falha ao atualizar observação' });
    }
  });

  // Delete a project observation
  app.delete("/api/projects/:id/observations/:obsId", async (req, res) => {
    try {
      const success = await storage.deleteNote(req.params.obsId);
      if (!success) {
        return res.status(404).json({ message: 'Observação não encontrada' });
      }
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Falha ao excluir observação' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
