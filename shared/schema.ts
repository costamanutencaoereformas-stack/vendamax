import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product Price History
 

export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  document: text("document").notNull().unique(), // CPF or CNPJ
  documentType: text("document_type").notNull(), // "CPF" or "CNPJ"
  stateRegistration: text("state_registration"), // Inscrição Estadual (only for CNPJ)
  stateRegistrationExempt: boolean("state_registration_exempt").default(false), // Isento de IE
  email: text("email"),
  phone: text("phone"),
  contact: text("contact"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  responsible: text("responsible"), // Responsável pelo cliente
  segment: text("segment"), // Segmento do cliente
  observations: text("observations"), // Observações sobre o cliente
  isActive: boolean("is_active").default(true),
  classification: text("classification").default("REGULAR"), // REGULAR, VIP, INACTIVE
  createdAt: timestamp("created_at").defaultNow(),
});

export const segments = pgTable("segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  color: text("color").default("#3B82F6"), // Cor para identificação visual
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  paymentTerms: text("payment_terms"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  barcode: text("barcode"),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id").references(() => categories.id),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  unit: text("unit").notNull().default("UN"), // UN, KG, M, etc.
  brand: text("brand"),
  ncm: text("ncm"),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }).notNull(),
  currentStock: integer("current_stock").default(0),
  minimumStock: integer("minimum_stock").default(0),
  maximumStock: integer("maximum_stock").default(1000),
  isActive: boolean("is_active").default(true),
  // Optional product image URL (served from /uploads/... or external)
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product Price History
export const productPriceHistory = pgTable("product_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  oldCostPrice: decimal("old_cost_price", { precision: 10, scale: 2 }).notNull(),
  newCostPrice: decimal("new_cost_price", { precision: 10, scale: 2 }).notNull(),
  changedAt: timestamp("changed_at").defaultNow(),
});

// Product <-> Supplier mapping with supplier-specific code and last purchase info
export const productSuppliers = pgTable("product_suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  supplierId: varchar("supplier_id").notNull().references(() => suppliers.id),
  supplierCode: text("supplier_code"),
  lastPrice: decimal("last_price", { precision: 10, scale: 2 }),
  lastPurchasedAt: timestamp("last_purchased_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const inventory = pgTable("inventory", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  type: text("type").notNull(), // IN, OUT, ADJUSTMENT
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Projects / Obras
export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // PJT000001
  name: text("name").notNull(),
  description: text("description"),
  customerId: varchar("customer_id").references(() => customers.id),
  quoteId: varchar("quote_id"), // referência opcional ao orçamento de origem
  saleId: varchar("sale_id"),   // referência opcional à venda
  status: text("status").notNull().default("PLANNING"), // PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED
  startDate: timestamp("start_date"),
  expectedEndDate: timestamp("expected_end_date"),
  endDate: timestamp("end_date"),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  progress: integer("progress").default(0), // 0-100
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectTasks = pgTable("project_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  description: text("description"),
  assignee: text("assignee"),
  startDate: timestamp("start_date"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("TODO"), // TODO, DOING, DONE, BLOCKED
  estimatedHours: decimal("estimated_hours", { precision: 10, scale: 2 }).default("0"),
  actualHours: decimal("actual_hours", { precision: 10, scale: 2 }).default("0"),
  cost: decimal("cost", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectExpenses = pgTable("project_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  date: timestamp("date").notNull(),
  category: text("category"),
  description: text("description"),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  linkedQuoteItemId: varchar("linked_quote_item_id"),
  linkedSaleItemId: varchar("linked_sale_item_id"),
  status: text("status").default("OPEN"), // OPEN, COMPLETED
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectDocuments = pgTable("project_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type").default("OTHER"), // CONTRACT, PHOTO, DRAWING, OTHER
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Contracts
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(), // CTR000001
  title: text("title").notNull(),
  customerId: varchar("customer_id").references(() => customers.id),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  projectId: varchar("project_id").references(() => projects.id),
  status: text("status").notNull().default("DRAFT"), // DRAFT, ACTIVE, SUSPENDED, CANCELLED, COMPLETED
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
  paymentTerms: text("payment_terms"),
  renewal: text("renewal"), // NONE, AUTO, MANUAL (texto livre por simplicidade)
  cancelDate: timestamp("cancel_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const contractDocuments = pgTable("contract_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  type: text("type").default("OTHER"), // PDF, IMAGE, OTHER
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const quoteAttachments = pgTable("quote_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
});

export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  status: text("status").default("PENDING"), // PENDING, APPROVED, REJECTED, CONVERTED
  validUntil: timestamp("valid_until").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  paymentTerms: text("payment_terms"),
  projectId: varchar("project_id").references(() => projects.id),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 }).default("0"),
  shipping: decimal("shipping", { precision: 10, scale: 2 }).default("0"),
  seller: text("seller"),
  companySignature: text("company_signature"),
  customerSignature: text("customer_signature"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const quoteItems = pgTable("quote_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  productId: varchar("product_id").references(() => products.id),
  serviceDescription: text("service_description"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
});

export const sales = pgTable("sales", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(),
  customerId: varchar("customer_id").notNull().references(() => customers.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  projectId: varchar("project_id").references(() => projects.id),
  status: text("status").default("COMPLETED"), // COMPLETED, CANCELLED, PROCESSING
  paymentMethod: text("payment_method").notNull(), // CASH, CARD, PIX, BOLETO
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  dueDate: timestamp("due_date"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id").notNull().references(() => sales.id),
  productId: varchar("product_id").references(() => products.id),
  serviceDescription: text("service_description"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  // Optional persisted service cost (only meaningful when productId is null)
  serviceCost: decimal("service_cost", { precision: 10, scale: 2 }),
});

// Purchase Requests (Solicitações de Compras)
export const purchaseRequests = pgTable("purchase_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  number: text("number").notNull().unique(), // PRQ000001
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  requester: text("requester"),
  status: text("status").notNull().default("DRAFT"), // DRAFT, SUBMITTED, APPROVED, REJECTED
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const purchaseRequestItems = pgTable("purchase_request_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestId: varchar("request_id").notNull().references(() => purchaseRequests.id),
  productId: varchar("product_id").references(() => products.id),
  description: text("description"),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 12, scale: 2 }),
});

// Appointments (Agenda)
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: text("type").notNull(), // VISIT, CALL, MEETING
  date: timestamp("date").notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING, DONE, CANCELED
  subject: text("subject"),
  notes: text("notes"),
  customerId: varchar("customer_id").references(() => customers.id), // opcional: não cliente
  contactName: text("contact_name"), // quando não cliente
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Finance (lançamentos financeiros)
// Tabela unificada para contas a receber/pagar e lançamentos de caixa
export const finance = pgTable("finance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code").unique(),
  // RECEIVABLE | PAYABLE | CASH
  entryType: text("entry_type").notNull(),
  // OPEN | PAID | OVERDUE | COMPLETED
  status: text("status").notNull().default("OPEN"),
  date: timestamp("date").notNull(),
  dueDate: timestamp("due_date"),
  description: text("description"),
  partyName: text("party_name"), // cliente/fornecedor quando aplicável
  customerId: varchar("customer_id").references(() => customers.id),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  saleId: varchar("sale_id").references(() => sales.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }),
  discountType: text("discount_type").default("FIXED_VALUE"), // FIXED_VALUE | PERCENTAGE
  surcharge: decimal("surcharge", { precision: 10, scale: 2 }),
  surchargeType: text("surcharge_type").default("FIXED_VALUE"), // FIXED_VALUE | PERCENTAGE
  paidAt: timestamp("paid_at"),
  paymentMethod: text("payment_method"), // PIX, DINHEIRO, DEBITO, CREDITO, etc.
  recurrence: text("recurrence"), // NONE, MONTHLY, WEEKLY
  category: text("category"),
  costCenter: text("cost_center"),
  project: text("project"),
  projectId: varchar("project_id"),
  notes: text("notes"),
  // ligação opcional a outro lançamento (ex.: movimento de caixa vinculado a um receber/pagar)
  // Nota: evitar referência direta à própria tabela para não criar ciclo de tipos no TS/Drizzle
  linkFinanceId: varchar("link_finance_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Company Settings (Dados da Empresa)
export const companySettings = pgTable("company_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cnpj: text("cnpj").notNull().unique(),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  stateRegistration: text("state_registration"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertSegmentSchema = createInsertSchema(segments).omit({
  id: true,
  createdAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertProductPriceHistorySchema = createInsertSchema(productPriceHistory).omit({
  id: true,
  changedAt: true,
});

export const insertProductSupplierSchema = createInsertSchema(productSuppliers).omit({
  id: true,
  createdAt: true,
});

export const insertInventorySchema = createInsertSchema(inventory).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteItemSchema = createInsertSchema(quoteItems).omit({
  id: true,
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
});

export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequests).omit({
  id: true,
  createdAt: true,
});

export const insertPurchaseRequestItemSchema = createInsertSchema(purchaseRequestItems).omit({
  id: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

export const insertFinanceSchema = createInsertSchema(finance).omit({
  id: true,
  createdAt: true,
}).extend({
  discount: z.string().or(z.number()).optional().nullable(),
  discountType: z.enum(["FIXED_VALUE", "PERCENTAGE"]).optional().nullable(),
  surcharge: z.string().or(z.number()).optional().nullable(),
  surchargeType: z.enum(["FIXED_VALUE", "PERCENTAGE"]).optional().nullable(),
  description: z.string().optional().nullable(),
  dueDate: z.date().optional().nullable(),
  paidAt: z.date().optional().nullable(),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  saleId: z.string().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  recurrence: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  costCenter: z.string().optional().nullable(),
  project: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  linkFinanceId: z.string().optional().nullable(),
});

export const insertCompanySettingsSchema = createInsertSchema(companySettings).omit({
  id: true,
  createdAt: true,
});

// Projects inserts
export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({
  id: true,
  createdAt: true,
});

export const insertProjectExpenseSchema = createInsertSchema(projectExpenses).omit({
  id: true,
  createdAt: true,
});

export const insertProjectDocumentSchema = createInsertSchema(projectDocuments).omit({
  id: true,
  uploadedAt: true,
});

// Contracts inserts
export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
});

export const insertContractDocumentSchema = createInsertSchema(contractDocuments).omit({
  id: true,
  uploadedAt: true,
  contractId: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;

export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Segment = typeof segments.$inferSelect;
export type InsertSegment = z.infer<typeof insertSegmentSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type ProductPriceHistory = typeof productPriceHistory.$inferSelect;
export type InsertProductPriceHistory = z.infer<typeof insertProductPriceHistorySchema>;

export type ProductSupplier = typeof productSuppliers.$inferSelect;
export type InsertProductSupplier = z.infer<typeof insertProductSupplierSchema>;

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = z.infer<typeof insertInventorySchema>;

export type QuoteAttachment = typeof quoteAttachments.$inferSelect;
export type InsertQuoteAttachment = typeof quoteAttachments.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = z.infer<typeof insertQuoteSchema>;

export type QuoteItem = typeof quoteItems.$inferSelect;
export type InsertQuoteItem = z.infer<typeof insertQuoteItemSchema>;

export type Sale = typeof sales.$inferSelect;
export type InsertSale = z.infer<typeof insertSaleSchema>;

export type SaleItem = typeof saleItems.$inferSelect;
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;

export type PurchaseRequest = typeof purchaseRequests.$inferSelect;
export type InsertPurchaseRequest = z.infer<typeof insertPurchaseRequestSchema>;

export type PurchaseRequestItem = typeof purchaseRequestItems.$inferSelect;
export type InsertPurchaseRequestItem = z.infer<typeof insertPurchaseRequestItemSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Finance = typeof finance.$inferSelect;
export type InsertFinance = z.infer<typeof insertFinanceSchema>;

export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;

// Projects types
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;

export type ProjectTask = typeof projectTasks.$inferSelect;
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;

export type ProjectExpense = typeof projectExpenses.$inferSelect;
export type InsertProjectExpense = z.infer<typeof insertProjectExpenseSchema>;

export type ProjectDocument = typeof projectDocuments.$inferSelect;
export type InsertProjectDocument = z.infer<typeof insertProjectDocumentSchema>;

// Contracts types
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export type ContractDocument = typeof contractDocuments.$inferSelect;
export type InsertContractDocument = z.infer<typeof insertContractDocumentSchema>;

// Notes table
export const notes = pgTable("notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  color: text("color").notNull().default("bg-white"),
  isPinned: boolean("is_pinned").notNull().default(false),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notes);

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

// Cash Register (Caixa/PDV)
export const cashRegisters = pgTable("cash_registers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // CX001, CX002, etc.
  name: text("name").notNull(), // Nome do caixa
  status: text("status").notNull().default("CLOSED"), // OPEN, CLOSED
  userId: varchar("user_id").references(() => users.id), // Operador atual
  openedAt: timestamp("opened_at"),
  closedAt: timestamp("closed_at"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).default("0"), // Saldo inicial
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).default("0"), // Saldo atual
  expectedBalance: decimal("expected_balance", { precision: 10, scale: 2 }).default("0"), // Saldo esperado
  closingBalance: decimal("closing_balance", { precision: 10, scale: 2 }), // Saldo no fechamento
  difference: decimal("difference", { precision: 10, scale: 2 }), // Diferença (quebra)
  notes: text("notes"), // Observações
  createdAt: timestamp("created_at").defaultNow(),
});

// Cash Register Movements (Movimentações de Caixa)
export const cashMovements = pgTable("cash_movements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  registerId: varchar("register_id").notNull().references(() => cashRegisters.id),
  type: text("type").notNull(), // OPENING, SALE, WITHDRAWAL, REINFORCEMENT, CLOSING
  description: text("description"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method"), // CASH, CARD, PIX, BOLETO (para vendas)
  saleId: varchar("sale_id").references(() => sales.id), // Referência à venda (se aplicável)
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCashRegisterSchema = createInsertSchema(cashRegisters).omit({
  id: true,
  createdAt: true,
});

export const insertCashMovementSchema = createInsertSchema(cashMovements).omit({
  id: true,
  createdAt: true,
});

export type CashRegister = typeof cashRegisters.$inferSelect;
export type InsertCashRegister = z.infer<typeof insertCashRegisterSchema>;

export type CashMovement = typeof cashMovements.$inferSelect;
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
