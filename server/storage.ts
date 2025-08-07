import { 
  type User, 
  type InsertUser,
  type Customer,
  type InsertCustomer,
  type Supplier,
  type InsertSupplier,
  type Category,
  type InsertCategory,
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
  type InsertSaleItem
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
  
  // Products
  getProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<boolean>;
  getLowStockProducts(): Promise<Product[]>;
  
  // Inventory
  getInventoryMovements(): Promise<Inventory[]>;
  getInventoryMovementsByProduct(productId: string): Promise<Inventory[]>;
  createInventoryMovement(movement: InsertInventory): Promise<Inventory>;
  
  // Quotes
  getQuotes(): Promise<Quote[]>;
  getQuote(id: string): Promise<Quote | undefined>;
  createQuote(quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote>;
  deleteQuote(id: string): Promise<boolean>;
  
  // Quote Items
  getQuoteItems(quoteId: string): Promise<QuoteItem[]>;
  createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem>;
  updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem>;
  deleteQuoteItem(id: string): Promise<boolean>;
  
  // Sales
  getSales(): Promise<Sale[]>;
  getSale(id: string): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale>;
  deleteSale(id: string): Promise<boolean>;
  
  // Sale Items
  getSaleItems(saleId: string): Promise<SaleItem[]>;
  createSaleItem(item: InsertSaleItem): Promise<SaleItem>;
  updateSaleItem(id: string, item: Partial<InsertSaleItem>): Promise<SaleItem>;
  deleteSaleItem(id: string): Promise<boolean>;
  
  // Dashboard metrics
  getDashboardMetrics(): Promise<{
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  }>;
}

export class MemStorage implements IStorage {
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
    
    // Initialize with default admin user
    this.initializeDefaultData();
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
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
      ...insertCustomer,
      id,
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
      ...insertSupplier,
      id,
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
      ...insertCategory,
      id,
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
    const product: Product = {
      ...insertProduct,
      id,
      createdAt: new Date()
    };
    this.products.set(id, product);
    return product;
  }

  async updateProduct(id: string, productData: Partial<InsertProduct>): Promise<Product> {
    const existing = this.products.get(id);
    if (!existing) throw new Error("Product not found");
    
    const updated: Product = { ...existing, ...productData };
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
      ...insertInventory,
      id,
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

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return Array.from(this.quotes.values());
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    return this.quotes.get(id);
  }

  async createQuote(insertQuote: InsertQuote): Promise<Quote> {
    const id = randomUUID();
    const quote: Quote = {
      ...insertQuote,
      id,
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

  async createQuoteItem(insertQuoteItem: InsertQuoteItem): Promise<QuoteItem> {
    const id = randomUUID();
    const item: QuoteItem = {
      ...insertQuoteItem,
      id
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

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    const sale: Sale = {
      ...insertSale,
      id,
      createdAt: new Date()
    };
    this.sales.set(id, sale);
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

  async createSaleItem(insertSaleItem: InsertSaleItem): Promise<SaleItem> {
    const id = randomUUID();
    const item: SaleItem = {
      ...insertSaleItem,
      id
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

export const storage = new MemStorage();
