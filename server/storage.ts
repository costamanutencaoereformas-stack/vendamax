import { 
  type User, 
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Supplier,
  type InsertSupplier,
  type Category,
  type InsertCategory,
  type Segment,
  type InsertSegment,
  type Product,
  type InsertProduct,
  type Inventory,
  type InsertInventory,
  type Quote,
  type InsertQuote,
  type QuoteItem,
  type InsertQuoteItem,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type Appointment,
  type InsertAppointment,
  type Finance,
  type InsertFinance,
  type CompanySettings,
  type InsertCompanySettings,
  type Project,
  type InsertProject,
  type ProjectTask,
  type InsertProjectTask,
  type ProjectExpense,
  type InsertProjectExpense,
  type ProjectDocument,
  type InsertProjectDocument,
  type Contract,
  type InsertContract,
  type ContractDocument,
  type InsertContractDocument,
  type Note,
  type InsertNote,
  type CashRegister,
  type InsertCashRegister,
  type CashMovement,
  type InsertCashMovement
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  
  // Customers
  getCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<boolean>;
  
  // Suppliers
  getSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<boolean>;
  
  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<boolean>;
  
  // Segments
  getSegments(): Promise<Segment[]>;
  getSegment(id: string): Promise<Segment | undefined>;
  createSegment(segment: InsertSegment): Promise<Segment>;
  updateSegment(id: string, segment: Partial<InsertSegment>): Promise<Segment>;
  deleteSegment(id: string): Promise<boolean>;
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<boolean>;
  getLowStockProducts(): Promise<Product[]>;
  
  // Inventory
  getInventoryMovement(id: string): Promise<Inventory | undefined>;
  getInventoryMovements(): Promise<Inventory[]>;
  getInventoryMovementsByProduct(productId: string): Promise<Inventory[]>;
  createInventoryMovement(movement: InsertInventory): Promise<Inventory>;
  updateInventoryMovement(id: string, movement: Partial<InsertInventory>): Promise<Inventory>;
  deleteInventoryMovement(id: string): Promise<boolean>;
  
  // Quotes
  getQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  getQuoteByNumber(number: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote>;
  deleteQuote(id: string): Promise<boolean>;
  
  // Quote Items
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  getQuoteItemById(id: string): Promise<QuoteItem | undefined>;
  createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(id: string): Promise<boolean>;
  
  // Sales
  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  getSaleByNumber(number: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale>;
  deleteSale(id: string): Promise<boolean>;
  
  // Sale Items
  getSaleItems(saleId: string): Promise<SaleItem[]>;
  getSaleItemById(id: string): Promise<SaleItem | undefined>;
  createSaleItem(item: InsertSaleItem): Promise<SaleItem>;
  updateSaleItem(id: string, item: Partial<InsertSaleItem>): Promise<SaleItem>;
  deleteSaleItem(id: string): Promise<boolean>;
  
  // Appointments (Agenda)
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  createAppointment(a: InsertAppointment): Promise<Appointment>; 
  updateAppointment(id: string, a: Partial<InsertAppointment>): Promise<Appointment>;
  deleteAppointment(id: string): Promise<boolean>;

  // Finance
  getFinanceEntries(): Promise<Finance[]>;
  getFinanceEntry(id: string): Promise<Finance | undefined>;
  createFinanceEntry(data: InsertFinance): Promise<Finance>;
  updateFinanceEntry(id: string, data: Partial<InsertFinance>): Promise<Finance>;
  deleteFinanceEntry(id: string): Promise<boolean>;
  markPaidWithCashMovement(id: string, payload: { date: Date; paymentMethod?: string | null; notes?: string | null }): Promise<{ updated: Finance; cash: Finance }>;
  
  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  }>;

  // Company settings
  getCompanySettings(): Promise<CompanySettings | undefined>;
  upsertCompanySettings(data: InsertCompanySettings): Promise<CompanySettings>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<boolean>;

  // Project Tasks
  getProjectTasks(projectId: string): Promise<ProjectTask[]>;
  createProjectTask(data: InsertProjectTask): Promise<ProjectTask>;
  updateProjectTask(id: string, data: Partial<InsertProjectTask>): Promise<ProjectTask>;
  deleteProjectTask(id: string): Promise<boolean>;

  // Project Expenses
  getProjectExpenses(projectId: string): Promise<ProjectExpense[]>;
  createProjectExpense(data: InsertProjectExpense): Promise<ProjectExpense>;
  updateProjectExpense(id: string, data: Partial<InsertProjectExpense>): Promise<ProjectExpense>;
  deleteProjectExpense(id: string): Promise<boolean>;

  // Project Documents
  getProjectDocuments(projectId: string): Promise<ProjectDocument[]>;
  createProjectDocument(data: InsertProjectDocument): Promise<ProjectDocument>;
  deleteProjectDocument(id: string): Promise<boolean>;

  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  getContractByNumber(number: string): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  updateContract(id: string, data: Partial<InsertContract>): Promise<Contract>;
  deleteContract(id: string): Promise<boolean>;

  // Contract Documents
  getContractDocuments(contractId: string): Promise<ContractDocument[]>;
  createContractDocument(data: InsertContractDocument): Promise<ContractDocument>;
  deleteContractDocument(id: string): Promise<boolean>;

  // Notes
  getNotes(userId?: string): Promise<Note[]>;
  getNote(id: string): Promise<Note | undefined>;
  createNote(data: InsertNote): Promise<Note>;
  updateNote(id: string, data: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: string): Promise<boolean>;

  // Purchase Requests
  getPurchaseRequests(): Promise<import("@shared/schema").PurchaseRequest[]>;
  getPurchaseRequest(id: string): Promise<import("@shared/schema").PurchaseRequest | undefined>;
  createPurchaseRequest(data: import("@shared/schema").InsertPurchaseRequest): Promise<import("@shared/schema").PurchaseRequest>;
  updatePurchaseRequest(id: string, data: Partial<import("@shared/schema").InsertPurchaseRequest>): Promise<import("@shared/schema").PurchaseRequest>;
  getPurchaseRequestItems(requestId: string): Promise<import("@shared/schema").PurchaseRequestItem[]>;
  addPurchaseRequestItem(data: import("@shared/schema").InsertPurchaseRequestItem): Promise<import("@shared/schema").PurchaseRequestItem>;
  updatePurchaseRequestItem(id: string, data: Partial<import("@shared/schema").InsertPurchaseRequestItem>): Promise<import("@shared/schema").PurchaseRequestItem>;
  removePurchaseRequestItem(id: string): Promise<boolean>;
  setPurchaseRequestStatus(id: string, status: 'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'): Promise<import("@shared/schema").PurchaseRequest>;

  // Cash Register
  getCurrentCashRegister?(): Promise<CashRegister | undefined>;
  getCashMovements?(registerId: string): Promise<CashMovement[]>;
  openCashRegister?(openingBalance: number): Promise<CashRegister>;
  closeCashRegister?(closingBalance: number): Promise<CashRegister>;
  addCashMovement?(type: string, amount: number, description?: string): Promise<CashMovement>;
  // History support
  listCashRegisters?(): Promise<CashRegister[]>;
  getCashRegisterById?(id: string): Promise<CashRegister | undefined>;
  getFinanceEntriesInPeriod?(start: Date, end: Date): Promise<Finance[]>;
}

export class MemStorage {
  private users: Map<string, User>;
  private customers: Map<string, Customer>;
  private suppliers: Map<string, Supplier>;
  private categories: Map<string, Category>;
  private products: Map<string, Product>;
  private inventory: Map<string, Inventory>;
  private quotes: Map<string, Quote>;
  private quoteItems: Map<string, QuoteItem>;
  private sales: Map<string, Sale>;
  private saleItems: Map<string, SaleItem>;
  private appointments: Map<string, Appointment>;
  private finances: Map<string, Finance>;
  private company?: CompanySettings;
  private projects: Map<string, Project>;
  private projectTasks: Map<string, ProjectTask>;
  private projectExpenses: Map<string, ProjectExpense>;
  private projectDocuments: Map<string, ProjectDocument>;
  private contracts: Map<string, Contract>;
  private contractDocuments: Map<string, ContractDocument>;
  private purchaseRequests: Map<string, import("@shared/schema").PurchaseRequest>;
  private purchaseRequestItems: Map<string, import("@shared/schema").PurchaseRequestItem>;

  constructor() {
    this.users = new Map();
    this.customers = new Map();
    this.suppliers = new Map();
    this.categories = new Map();
    this.products = new Map();
    this.inventory = new Map();
    this.quotes = new Map();
    this.quoteItems = new Map();
    this.sales = new Map();
    this.saleItems = new Map();
    this.appointments = new Map();
    this.finances = new Map();
    this.projects = new Map();
    this.projectTasks = new Map();
    this.projectExpenses = new Map();
    this.projectDocuments = new Map();
    this.purchaseRequests = new Map();
    this.purchaseRequestItems = new Map();
    this.contracts = new Map();
    this.contractDocuments = new Map();
    
    // Initialize with default admin user
    this.initializeDefaultData();
  }

  // Company settings
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    return this.company;
  }

  async upsertCompanySettings(data: InsertCompanySettings): Promise<CompanySettings> {
    // Simple upsert by CNPJ
    if (this.company && this.company.cnpj === data.cnpj) {
      this.company = { ...this.company, ...data } as CompanySettings;
    } else {
      const id = randomUUID();
      this.company = { id, createdAt: new Date(), ...(data as any) } as CompanySettings;
    }
    return this.company;
  }

  private async initializeDefaultData() {
    const adminUser: User = {
      id: randomUUID(),
      username: "admin",
      password: "admin123",
      name: "Administrador",
      role: "admin",
      createdAt: new Date(),
    };
    this.users.set(adminUser.id, adminUser);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.username,
      password: insertUser.password,
      name: insertUser.name,
      role: (insertUser as any).role ?? 'user',
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const customer: Customer = {
      id,
      name: insertCustomer.name,
      document: insertCustomer.document,
      documentType: (insertCustomer as any).documentType ?? 'CPF',
      email: insertCustomer.email ?? null,
      phone: insertCustomer.phone ?? null,
      contact: (insertCustomer as any).contact ?? null,
      address: insertCustomer.address ?? null,
      city: insertCustomer.city ?? null,
      state: insertCustomer.state ?? null,
      zipCode: insertCustomer.zipCode ?? null,
      responsible: (insertCustomer as any).responsible ?? null,
      segment: (insertCustomer as any).segment ?? null,
      observations: (insertCustomer as any).observations ?? null,
      isActive: insertCustomer.isActive ?? true,
      classification: insertCustomer.classification ?? 'REGULAR',
      createdAt: new Date()
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, customerData: Partial<InsertCustomer>): Promise<Customer> {
    const existing = this.customers.get(id);
    if (!existing) throw new Error("Customer not found");
    
    const updated: Customer = { ...existing, ...customerData };
    this.customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return Array.from(this.suppliers.values());
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    return this.suppliers.get(id);
  }

  async createSupplier(insertSupplier: InsertSupplier): Promise<Supplier> {
    const id = randomUUID();
    const supplier: Supplier = {
      id,
      name: insertSupplier.name,
      tradeName: insertSupplier.tradeName ?? null,
      cnpj: insertSupplier.cnpj,
      email: insertSupplier.email ?? null,
      phone: insertSupplier.phone ?? null,
      address: insertSupplier.address ?? null,
      city: insertSupplier.city ?? null,
      state: insertSupplier.state ?? null,
      zipCode: insertSupplier.zipCode ?? null,
      paymentTerms: insertSupplier.paymentTerms ?? null,
      isActive: insertSupplier.isActive ?? true,
      createdAt: new Date()
    };
    this.suppliers.set(id, supplier);
    return supplier;
  }

  async updateSupplier(id: string, supplierData: Partial<InsertSupplier>): Promise<Supplier> {
    const existing = this.suppliers.get(id);
    if (!existing) throw new Error("Supplier not found");
    
    const updated: Supplier = { ...existing, ...supplierData };
    this.suppliers.set(id, updated);
    return updated;
  }

  async deleteSupplier(id: string): Promise<boolean> {
    return this.suppliers.delete(id);
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const category: Category = {
      id,
      name: insertCategory.name,
      description: insertCategory.description ?? null,
      createdAt: new Date()
    };
    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id: string, categoryData: Partial<InsertCategory>): Promise<Category> {
    const existing = this.categories.get(id);
    if (!existing) throw new Error("Category not found");
    
    const updated: Category = { ...existing, ...categoryData };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categories.delete(id);
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const id = randomUUID();
    // Always generate a unique 6-digit numeric internal code
    const existingCodes = new Set(Array.from(this.products.values()).map(p => p.code));
    let code: string | null = null;
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
      if (!existingCodes.has(candidate)) { code = candidate; break; }
    }
    if (!code) code = String(Date.now()).slice(-6).padStart(6, '0');

    const product: Product = {
      id,
      code,
      barcode: insertProduct.barcode ?? null,
      name: insertProduct.name,
      description: insertProduct.description ?? null,
      categoryId: insertProduct.categoryId ?? null,
      supplierId: insertProduct.supplierId ?? null,
      imageUrl: (insertProduct as any).imageUrl ?? null,
      unit: insertProduct.unit ?? 'UN',
      costPrice: insertProduct.costPrice,
      salePrice: insertProduct.salePrice,
      currentStock: insertProduct.currentStock ?? 0,
      minimumStock: insertProduct.minimumStock ?? 0,
      maximumStock: insertProduct.maximumStock ?? 1000,
      isActive: insertProduct.isActive ?? true,
      createdAt: new Date()
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, productData: Partial<InsertProduct>): Promise<Product> {
    const existing = this.products.get(id);
    if (!existing) throw new Error("Product not found");
    
    const updated: Product = { ...existing, ...productData, imageUrl: (productData as any).imageUrl ?? existing.imageUrl };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  async getLowStockProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(
      product => product.currentStock !== null && 
                 product.minimumStock !== null && 
                 product.currentStock <= product.minimumStock
    );
  }

  // Inventory
  async getInventoryMovement(id: string): Promise<Inventory | undefined> {
    return this.inventory.get(id);
  }

  async getInventoryMovements(): Promise<Inventory[]> {
    return Array.from(this.inventory.values());
  }

  async getInventoryMovementsByProduct(productId: string): Promise<Inventory[]> {
    return Array.from(this.inventory.values()).filter(
      movement => movement.productId === productId
    );
  }

  async createInventoryMovement(insertInventory: InsertInventory): Promise<Inventory> {
    const id = randomUUID();
    const movement: Inventory = {
      id,
      productId: insertInventory.productId,
      type: insertInventory.type,
      quantity: insertInventory.quantity,
      reason: insertInventory.reason ?? null,
      userId: insertInventory.userId ?? null,
      createdAt: new Date()
    };
    this.inventory.set(id, movement);
    
    // Update product stock
    const product = this.products.get(insertInventory.productId);
    if (product) {
      const currentStock = product.currentStock || 0;
      let newStock = currentStock;
      
      if (insertInventory.type === "IN") {
        newStock += insertInventory.quantity;
      } else if (insertInventory.type === "OUT") {
        newStock -= insertInventory.quantity;
      } else if (insertInventory.type === "ADJUSTMENT") {
        newStock = insertInventory.quantity;
      }
      
      this.products.set(insertInventory.productId, {
        ...product,
        currentStock: Math.max(0, newStock)
      });
    }
    
    return movement;
  }

  async updateInventoryMovement(id: string, movementData: Partial<InsertInventory>): Promise<Inventory> {
    const existing = this.inventory.get(id);
    if (!existing) throw new Error("Inventory movement not found");

    // revert old effect on stock
    const product = this.products.get(existing.productId);
    if (product) {
      let stock = product.currentStock || 0;
      if (existing.type === "IN") stock -= existing.quantity;
      else if (existing.type === "OUT") stock += existing.quantity;
      else if (existing.type === "ADJUSTMENT") {
        // cannot infer previous, set to 0 then will apply new below
        stock = 0;
      }
      this.products.set(existing.productId, { ...product, currentStock: Math.max(0, stock) });
    }

    // apply new data on movement
    const updated: Inventory = { ...existing, ...movementData } as Inventory;
    this.inventory.set(id, updated);

    // apply new effect on stock
    const prodForNew = this.products.get(updated.productId);
    if (prodForNew) {
      let stock = prodForNew.currentStock || 0;
      if (updated.type === "IN") stock += updated.quantity;
      else if (updated.type === "OUT") stock -= updated.quantity;
      else if (updated.type === "ADJUSTMENT") stock = updated.quantity;
      this.products.set(updated.productId, { ...prodForNew, currentStock: Math.max(0, stock) });
    }

    return updated;
  }

  async deleteInventoryMovement(id: string): Promise<boolean> {
    const existing = this.inventory.get(id);
    if (!existing) return false;

    // revert effect on stock
    const product = this.products.get(existing.productId);
    if (product) {
      let stock = product.currentStock || 0;
      if (existing.type === "IN") stock -= existing.quantity;
      else if (existing.type === "OUT") stock += existing.quantity;
      else if (existing.type === "ADJUSTMENT") {
        // cannot restore previous baseline; leave as-is
      }
      this.products.set(existing.productId, { ...product, currentStock: Math.max(0, stock) });
    }

    return this.inventory.delete(id);
  }

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values());
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async getQuoteByNumber(number: string): Promise<Quote | undefined> {
    const all = Array.from(this.quotes.values());
    return all.find(q => q.number === number);
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const quote: Quote = {
      id,
      number: insertQuote.number,
      customerId: insertQuote.customerId,
      status: (insertQuote as any).status ?? 'PENDING',
      validUntil: insertQuote.validUntil,
      subtotal: insertQuote.subtotal,
      discount: insertQuote.discount ?? '0',
      total: insertQuote.total,
      notes: insertQuote.notes ?? null,
      paymentTerms: (insertQuote as any).paymentTerms ?? null,
      projectId: (insertQuote as any).projectId ?? null,
      taxTotal: (insertQuote as any).taxTotal ?? '0',
      shipping: (insertQuote as any).shipping ?? '0',
      seller: (insertQuote as any).seller ?? null,
      companySignature: (insertQuote as any).companySignature ?? null,
      customerSignature: (insertQuote as any).customerSignature ?? null,
      userId: (insertQuote as any).userId ?? null,
      createdAt: new Date()
    };
    this.quotes.set(id, quote);
    return quote;
  }

  async updateQuote(id: string, quoteData: Partial<InsertQuote>): Promise<Quote> {
    const existing = this.quotes.get(id);
    if (!existing) throw new Error("Quote not found");
    
    const updated: Quote = { ...existing, ...quoteData };
    this.quotes.set(id, updated);
    return updated;
  }

  async deleteQuote(id: string): Promise<boolean> {
    return this.quotes.delete(id);
  }

  // Quote Items
  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return Array.from(this.quoteItems.values()).filter(
      item => item.quoteId === quoteId
    );
  }

  async getQuoteItemById(id: string): Promise<QuoteItem | undefined> {
    return this.quoteItems.get(id);
  }

  async createQuoteItem(insertQuoteItem: InsertQuoteItem): Promise<QuoteItem> {
    const id = randomUUID();
    const item: QuoteItem = {
      id,
      quoteId: insertQuoteItem.quoteId,
      productId: insertQuoteItem.productId ?? null,
      serviceDescription: insertQuoteItem.serviceDescription ?? null,
      quantity: insertQuoteItem.quantity,
      unitPrice: insertQuoteItem.unitPrice,
      discount: insertQuoteItem.discount ?? '0',
      total: insertQuoteItem.total
    };
    this.quoteItems.set(id, item);
    return item;
  }

  async updateQuoteItem(id: string, itemData: Partial<InsertQuoteItem>): Promise<QuoteItem> {
    const existing = this.quoteItems.get(id);
    if (!existing) throw new Error("Quote item not found");
    
    const updated: QuoteItem = { ...existing, ...itemData };
    this.quoteItems.set(id, updated);
    return updated;
  }

  async deleteQuoteItem(id: string): Promise<boolean> {
    return this.quoteItems.delete(id);
  }

  // Sales
  async getSales(): Promise<Sale[]> {
    return Array.from(this.sales.values());
  }

  async getSale(id: string): Promise<Sale | undefined> {
    return this.sales.get(id);
  }

  async getSaleByNumber(number: string): Promise<Sale | undefined> {
    for (const sale of this.sales.values()) {
      if (sale.number === number) return sale;
    }
    return undefined;
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    
    // Extrair itens do payload se fornecidos
    const items = (insertSale as any).items || [];
    const saleData = { ...insertSale };
    delete (saleData as any).items; // Remover itens do payload da venda
    
    const sale: Sale = {
      id,
      number: saleData.number,
      customerId: saleData.customerId,
      quoteId: saleData.quoteId ?? null,
      projectId: (saleData as any).projectId ?? null,
      status: (saleData as any).status ?? 'COMPLETED',
      paymentMethod: saleData.paymentMethod,
      subtotal: saleData.subtotal,
      discount: saleData.discount ?? '0',
      total: saleData.total,
      notes: saleData.notes ?? null,
      dueDate: saleData.dueDate ?? null,
      userId: (saleData as any).userId ?? null,
      createdAt: new Date()
    };
    this.sales.set(id, sale);
    
    // Se há itens fornecidos no payload, criar eles primeiro
    if (items.length > 0) {
      try {
        console.log(`[createSale] Criando ${items.length} itens fornecidos para venda ${id}`);
        
        for (const item of items) {
          await this.createSaleItem({
            saleId: id,
            productId: item.productId || null,
            serviceDescription: item.serviceDescription || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || '0',
            total: item.total,
          });
        }
        
        console.log(`[createSale] Itens fornecidos criados com sucesso para venda ${id}`);
      } catch (e) {
        console.error('[createSale] Falha ao criar itens fornecidos para a venda', e);
        // Não falhar a criação da venda se a criação de itens falhar
      }
    }
    // Se não há itens fornecidos mas há quoteId, copiar itens do orçamento
    else if (sale.quoteId) {
      try {
        const qItems = await this.getQuoteItems(sale.quoteId);
        if (qItems.length > 0) {
          console.log(`[createSale] Copiando ${qItems.length} itens do orçamento ${sale.quoteId} para venda ${id}`);
          
          for (const qi of qItems) {
            await this.createSaleItem({
              saleId: id,
              productId: qi.productId ?? null,
              serviceDescription: qi.serviceDescription ?? null,
              quantity: qi.quantity,
              unitPrice: qi.unitPrice,
              discount: qi.discount ?? '0',
              total: qi.total,
            });
          }
          
          console.log(`[createSale] Itens copiados com sucesso para venda ${id}`);
        }
      } catch (e) {
        console.error('[createSale] Falha ao copiar itens do orçamento para a venda', e);
        // Não falhar a criação da venda se a cópia de itens falhar
      }
    }
    
    return sale;
  }

  async updateSale(id: string, saleData: Partial<InsertSale>): Promise<Sale> {
    const existing = this.sales.get(id);
    if (!existing) throw new Error("Sale not found");
    
    const updated: Sale = { ...existing, ...saleData };
    this.sales.set(id, updated);
    return updated;
  }

  async deleteSale(id: string): Promise<boolean> {
    return this.sales.delete(id);
  }

  // Sale Items
  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    return Array.from(this.saleItems.values()).filter(
      item => item.saleId === saleId
    );
  }

  async getSaleItemById(id: string): Promise<SaleItem | undefined> {
    return this.saleItems.get(id);
  }

  async createSaleItem(insertSaleItem: InsertSaleItem): Promise<SaleItem> {
    const id = randomUUID();
    const item: SaleItem = {
      id,
      saleId: insertSaleItem.saleId,
      productId: insertSaleItem.productId ?? null,
      serviceDescription: insertSaleItem.serviceDescription ?? null,
      quantity: insertSaleItem.quantity,
      unitPrice: insertSaleItem.unitPrice,
      discount: insertSaleItem.discount ?? '0',
      total: insertSaleItem.total
    };
    this.saleItems.set(id, item);
    return item;
  }

  async updateSaleItem(id: string, itemData: Partial<InsertSaleItem>): Promise<SaleItem> {
    const existing = this.saleItems.get(id);
    if (!existing) throw new Error("Sale item not found");
    
    const updated: SaleItem = { ...existing, ...itemData };
    this.saleItems.set(id, updated);
    return updated;
  }

  async deleteSaleItem(id: string): Promise<boolean> {
    return this.saleItems.delete(id);
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }
  async getAppointment(id: string): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }
  async createAppointment(a: InsertAppointment): Promise<Appointment> {
    const id = randomUUID();
    const app: Appointment = {
      id,
      type: a.type,
      date: a.date,
      status: (a as any).status ?? 'PENDING',
      subject: (a as any).subject ?? null,
      notes: (a as any).notes ?? null,
      customerId: (a as any).customerId ?? null,
      contactName: (a as any).contactName ?? null,
      contactPhone: (a as any).contactPhone ?? null,
      createdAt: new Date()
    } as Appointment;
    this.appointments.set(id, app);
    return app;
  }
  async updateAppointment(id: string, a: Partial<InsertAppointment>): Promise<Appointment> {
    const current = this.appointments.get(id);
    if (!current) throw new Error('Appointment not found');
    const updated = { ...current, ...a } as Appointment;
    this.appointments.set(id, updated);
    return updated;
  }
  async deleteAppointment(id: string): Promise<boolean> {
    return this.appointments.delete(id);
  }

  async deleteProjectDocument(id: string): Promise<boolean> {
    return this.projectDocuments.delete(id);
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return Array.from(this.contracts.values());
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return this.contracts.get(id);
  }

  async getContractByNumber(number: string): Promise<Contract | undefined> {
    return Array.from(this.contracts.values()).find(c => c.number === number);
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const id = randomUUID();
    const contract: Contract = {
      id,
      number: data.number,
      title: (data as any).title ?? null,
      customerId: (data as any).customerId ?? null,
      supplierId: (data as any).supplierId ?? null,
      projectId: (data as any).projectId ?? null,
      status: (data as any).status ?? 'DRAFT',
      startDate: (data as any).startDate ?? null,
      endDate: (data as any).endDate ?? null,
      totalValue: (data as any).totalValue ?? null,
      paymentTerms: (data as any).paymentTerms ?? null,
      renewal: (data as any).renewal ?? null,
      cancelDate: (data as any).cancelDate ?? null,
      notes: (data as any).notes ?? null,
      createdAt: new Date(),
    } as any;
    this.contracts.set(id, contract);
    return contract;
  }

  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract> {
    const existing = this.contracts.get(id);
    if (!existing) throw new Error('Contract not found');
    const updated: Contract = { ...existing, ...(data as any) } as any;
    this.contracts.set(id, updated);
    return updated;
  }

  async deleteContract(id: string): Promise<boolean> {
    return this.contracts.delete(id);
  }

  // Contract Documents
  async getContractDocuments(contractId: string): Promise<ContractDocument[]> {
    return Array.from(this.contractDocuments.values()).filter(d => d.contractId === contractId);
  }

  async addContractDocument(data: InsertContractDocument & { contractId: string }): Promise<ContractDocument> {
    const id = randomUUID();
    const doc: ContractDocument = { id, uploadedAt: new Date(), ...(data as any) } as any;
    this.contractDocuments.set(id, doc);
    return doc;
  }

  async deleteContractDocument(id: string): Promise<boolean> {
    return this.contractDocuments.delete(id);
  }

  // Quote Attachments
  private quoteAttachments = new Map<string, import("@shared/schema").QuoteAttachment>();

  async getQuoteAttachments(quoteId: string): Promise<import("@shared/schema").QuoteAttachment[]> {
    return Array.from(this.quoteAttachments.values())
      .filter(attachment => attachment.quoteId === quoteId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async getQuoteAttachment(id: string): Promise<import("@shared/schema").QuoteAttachment | undefined> {
    return this.quoteAttachments.get(id);
  }

  async addQuoteAttachment(data: import("@shared/schema").InsertQuoteAttachment): Promise<import("@shared/schema").QuoteAttachment> {
    const id = randomUUID();
    const now = new Date();
    const attachment = {
      ...data,
      id,
      uploadedAt: now,
    };
    this.quoteAttachments.set(id, attachment as any);
    return attachment as any;
  }

  async deleteQuoteAttachment(id: string): Promise<boolean> {
    return this.quoteAttachments.delete(id);
  }

  // Purchase Requests
  async getPurchaseRequests(): Promise<import("@shared/schema").PurchaseRequest[]> {
    return Array.from(this.purchaseRequests.values()).sort((a, b) => +new Date(b.createdAt!) - +new Date(a.createdAt!));
  }
  async getPurchaseRequest(id: string): Promise<import("@shared/schema").PurchaseRequest | undefined> {
    return this.purchaseRequests.get(id);
  }
  async createPurchaseRequest(data: import("@shared/schema").InsertPurchaseRequest): Promise<import("@shared/schema").PurchaseRequest> {
    const id = randomUUID();
    const pr: import("@shared/schema").PurchaseRequest = { id, createdAt: new Date(), ...(data as any) } as any;
    this.purchaseRequests.set(id, pr);
    return pr;
  }
  async updatePurchaseRequest(id: string, data: Partial<import("@shared/schema").InsertPurchaseRequest>): Promise<import("@shared/schema").PurchaseRequest> {
    const cur = this.purchaseRequests.get(id);
    if (!cur) throw new Error('Purchase request not found');
    const up = { ...cur, ...(data as any) } as any;
    this.purchaseRequests.set(id, up);
    return up;
  }
  async getPurchaseRequestItems(requestId: string): Promise<import("@shared/schema").PurchaseRequestItem[]> {
    return Array.from(this.purchaseRequestItems.values()).filter(i => i.requestId === requestId);
  }
  async addPurchaseRequestItem(data: import("@shared/schema").InsertPurchaseRequestItem): Promise<import("@shared/schema").PurchaseRequestItem> {
    const id = randomUUID();
    const it: import("@shared/schema").PurchaseRequestItem = { id, ...(data as any) } as any;
    this.purchaseRequestItems.set(id, it);
    return it;
  }
  async updatePurchaseRequestItem(id: string, data: Partial<import("@shared/schema").InsertPurchaseRequestItem>): Promise<import("@shared/schema").PurchaseRequestItem> {
    const existing = this.purchaseRequestItems.get(id);
    if (!existing) throw new Error('Purchase request item not found');
    const updated = { ...existing, ...(data as any) } as import("@shared/schema").PurchaseRequestItem;
    this.purchaseRequestItems.set(id, updated);
    return updated;
  }
  async removePurchaseRequestItem(id: string): Promise<boolean> {
    return this.purchaseRequestItems.delete(id);
  }
  async setPurchaseRequestStatus(id: string, status: 'DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'): Promise<import("@shared/schema").PurchaseRequest> {
    const cur = this.purchaseRequests.get(id);
    if (!cur) throw new Error('Purchase request not found');
    const up = { ...cur, status } as any;
    this.purchaseRequests.set(id, up);
    return up;
  }

  // Quote Attachments
  getQuoteAttachments(quoteId: string): Promise<import("@shared/schema").QuoteAttachment[]>;
  getQuoteAttachment(id: string): Promise<import("@shared/schema").QuoteAttachment | undefined>;
  addQuoteAttachment(data: import("@shared/schema").InsertQuoteAttachment): Promise<import("@shared/schema").QuoteAttachment>;
  deleteQuoteAttachment(id: string): Promise<boolean>;

  // Finance (In-memory fallback)
  async getFinanceEntries(): Promise<Finance[]> {
    // Return newest first
    return Array.from(this.finances.values()).sort((a, b) => +new Date(b.createdAt!) - +new Date(a.createdAt!));
  }

  async getFinanceEntry(id: string): Promise<Finance | undefined> {
    return this.finances.get(id);
  }

  async createFinanceEntry(data: InsertFinance): Promise<Finance> {
    const id = randomUUID();
    
    // Generate code if not provided
    let code = (data as any).code;
    if (!code) {
      const prefix = data.entryType === 'RECEIVABLE' ? 'REC' : (data.entryType === 'PAYABLE' ? 'PAG' : 'CX');
      const count = Array.from(this.finances.values()).filter(f => f.entryType === data.entryType).length + 1;
      code = `${prefix}-${String(count).padStart(5, '0')}`;
    }
    
    const entry: Finance = { id, code, createdAt: new Date(), ...(data as any) } as Finance;
    this.finances.set(id, entry);
    return entry;
  }

  async updateFinanceEntry(id: string, data: Partial<InsertFinance>): Promise<Finance> {
    const existing = this.finances.get(id);
    if (!existing) throw new Error("Finance entry not found");
    const updated: Finance = { ...existing, ...(data as any) } as Finance;
    this.finances.set(id, updated);
    return updated;
    }

  async deleteFinanceEntry(id: string): Promise<boolean> {
    return this.finances.delete(id);
  }

  async markPaidWithCashMovement(id: string, payload: { date: Date; paymentMethod?: string | null; notes?: string | null }): Promise<{ updated: Finance; cash: Finance }> {
    const existing = this.finances.get(id);
    if (!existing) throw new Error("Finance entry not found");
    const updated: Finance = { ...existing, status: "PAID", paidAt: payload.date } as any;
    this.finances.set(id, updated);
    // Create linked CASH movement
    const cashCode = `CX-${String(Array.from(this.finances.values()).filter(f => f.entryType === 'CASH').length + 1).padStart(5, '0')}`;
    const cash: Finance = {
      id: randomUUID(),
      code: cashCode,
      entryType: "CASH" as any,
      status: "PAID" as any,
      date: payload.date,
      dueDate: payload.date as any,
      description: updated.description || (updated.entryType === "RECEIVABLE" ? `Recebimento - ${updated.partyName || ''}` : `Pagamento - ${updated.partyName || ''}`),
      partyName: updated.partyName || null as any,
      customerId: updated.customerId as any,
      supplierId: updated.supplierId as any,
      saleId: (updated as any).saleId,
      amount: (updated.entryType === "RECEIVABLE" ? updated.amount : (0 - Number(updated.amount))) as any,
      paidAt: payload.date,
      paymentMethod: payload.paymentMethod || (updated as any).paymentMethod,
      recurrence: null as any,
      category: (updated as any).category,
      costCenter: (updated as any).costCenter,
      project: (updated as any).project,
      projectId: (updated as any).projectId,
      notes: payload.notes || (updated as any).notes,
      linkFinanceId: updated.id as any,
      createdAt: new Date(),
    } as any;
    this.finances.set(cash.id, cash);
    return { updated, cash };
  }

  // Dashboard metrics
  async getDashboardMetrics(): Promise<{
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailySales = Array.from(this.sales.values())
      .filter(sale => sale.createdAt && sale.createdAt >= today)
      .reduce((sum, sale) => sum + parseFloat(sale.total), 0);
    
    const pendingQuotes = Array.from(this.quotes.values())
      .filter(quote => quote.status === "PENDING").length;
    
    const totalProducts = this.products.size;
    
    const activeCustomers = Array.from(this.customers.values())
      .filter(customer => customer.isActive).length;
    
    const lowStockItems = (await this.getLowStockProducts()).length;
    
    return {
      dailySales,
      pendingQuotes,
      totalProducts,
      activeCustomers,
      lowStockItems
    };
  }
}

// Importar SupabaseStorage
import { SupabaseStorage } from './supabase-storage';

// Usar SupabaseStorage em vez de MemStorage
export const storage = new SupabaseStorage();
