import { IStorage } from './storage';
import { db } from './supabase';
import { eq, and, lte, gte, desc, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  users,
  customers,
  suppliers,
  categories,
  segments,
  products,
  inventory,
  quotes,
  quoteItems,
  sales,
  saleItems,
  appointments,
  finance,
  companySettings,
  projects,
  projectTasks,
  projectExpenses,
  projectDocuments,
  purchaseRequests,
  purchaseRequestItems,
  contracts,
  contractDocuments,
  quoteAttachments,
  notes,
  cashRegisters,
  cashMovements,
  productPriceHistory,
  productSuppliers,
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
  type ProductPriceHistory,
  type InsertProductPriceHistory,
  type ProductSupplier,
  type InsertProductSupplier,
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
  type InsertAppointment
  , type CompanySettings, type InsertCompanySettings,
  type Finance, type InsertFinance,
  type Project, type InsertProject,
  type ProjectTask, type InsertProjectTask,
  type ProjectExpense, type InsertProjectExpense,
  type ProjectDocument, type InsertProjectDocument
  , type PurchaseRequest, type InsertPurchaseRequest
  , type PurchaseRequestItem, type InsertPurchaseRequestItem,
  type Contract,
  type InsertContract,
  type ContractDocument,
  type InsertContractDocument,
  type Note,
  type InsertNote,
  type QuoteAttachment,
  type InsertQuoteAttachment,
  type CashRegister,
  type InsertCashRegister,
  type CashMovement,
  type InsertCashMovement
} from '@shared/schema';

export class SupabaseStorage implements IStorage {
  // Auto-migration: ensure finance columns exist (code, project_id), backfill code, and index
  async ensureFinanceCode(): Promise<void> {
    if (!db) return;
    try {
      // 1) Add column if not exists
      await db.execute(sql`ALTER TABLE ${finance} ADD COLUMN IF NOT EXISTS code text`);
      await db.execute(sql`ALTER TABLE ${finance} ADD COLUMN IF NOT EXISTS project_id text`);

      // 2) Backfill codes for rows without code
      // Using raw SQL due to window function and partitioning requirements
      await db.execute(sql`
        WITH ranked AS (
          SELECT
            ${finance.id} as id,
            ${finance.entryType} as entry_type,
            ${finance.createdAt} as created_at,
            CASE
              WHEN ${finance.entryType} = 'RECEIVABLE' THEN 'REC'
              WHEN ${finance.entryType} = 'PAYABLE' THEN 'PAG'
              ELSE 'CX'
            END AS prefix,
            ROW_NUMBER() OVER (
              PARTITION BY ${finance.entryType}
              ORDER BY ${finance.createdAt} NULLS FIRST, ${finance.id}
            ) AS rn
          FROM ${finance}
          WHERE code IS NULL
        )
        UPDATE ${finance} f
        SET code = ranked.prefix || '-' || LPAD(ranked.rn::text, 5, '0')
        FROM ranked
        WHERE f.id = ranked.id;
      `);

      // 3) Unique index on non-null codes
      await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS finance_code_unique ON ${finance} (code) WHERE code IS NOT NULL`);
    } catch (e) {
      // Best-effort; log and continue
      console.warn('[ensureFinanceCode] non-fatal:', e as any);
    }
  }

  // Auto-migration: ensure extra product columns (brand, ncm)
  async ensureProductExtraColumns(): Promise<void> {
    if (!db) return;
    try {
      await db.execute(sql`ALTER TABLE ${products} ADD COLUMN IF NOT EXISTS brand text`);
      await db.execute(sql`ALTER TABLE ${products} ADD COLUMN IF NOT EXISTS ncm text`);
    } catch (e) {
      console.warn('[ensureProductExtraColumns] non-fatal:', e as any);
    }
  }

  // Auto-migration: create product auxiliary tables if not exist
  async ensureProductAuxTables(): Promise<void> {
    if (!db) return;
    try {
      await db.execute(sql`CREATE TABLE IF NOT EXISTS product_price_history (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id text NOT NULL,
        old_cost_price numeric(10,2) NOT NULL,
        new_cost_price numeric(10,2) NOT NULL,
        changed_at timestamp DEFAULT now()
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS product_suppliers (
        id text PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id text NOT NULL,
        supplier_id text NOT NULL,
        supplier_code text,
        last_price numeric(10,2),
        last_purchased_at timestamp,
        created_at timestamp DEFAULT now()
      )`);
      // Optional: basic indexes
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pph_product ON product_price_history(product_id, changed_at DESC)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ps_product ON product_suppliers(product_id)`);
      await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_ps_supplier ON product_suppliers(supplier_id)`);
    } catch (e) {
      console.warn('[ensureProductAuxTables] non-fatal:', e as any);
    }
  }
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  // History helpers
  async listCashRegisters(): Promise<CashRegister[]> {
    const rows = await db
      .select()
      .from(cashRegisters)
      .orderBy(desc(cashRegisters.openedAt));
    return rows as CashRegister[];
  }

  async getCashRegisterById(id: string): Promise<CashRegister | undefined> {
    const rows = await db.select().from(cashRegisters).where(eq(cashRegisters.id, id));
    return rows[0] as CashRegister | undefined;
  }

  async getFinanceEntriesInPeriod(start: Date, end: Date): Promise<Finance[]> {
    // By convention we use finance.date to filter entries within the register period
    const rows = await db
      .select({
        id: finance.id,
        entryType: finance.entryType,
        status: finance.status,
        date: finance.date,
        dueDate: finance.dueDate,
        description: finance.description,
        partyName: finance.partyName,
        customerId: finance.customerId,
        supplierId: finance.supplierId,
        saleId: finance.saleId,
        amount: finance.amount,
        paidAt: finance.paidAt,
        paymentMethod: finance.paymentMethod,
        recurrence: finance.recurrence,
        category: finance.category,
        costCenter: finance.costCenter,
        project: finance.project,
        projectId: finance.projectId,
        notes: finance.notes,
        linkFinanceId: finance.linkFinanceId,
        createdAt: finance.createdAt,
      })
      .from(finance)
      .where(and(gte(finance.date, start), lte(finance.date, end)))
      .orderBy(desc(finance.date));
    return rows as unknown as Finance[];
  }

  async getPaymentSummaryForPeriod(start: Date, end: Date): Promise<Array<{ paymentMethod: string; total: number; count: number }>> {
    // Aggregate sales totals by payment method within the period
    const rows = await db
      .select({
        paymentMethod: sales.paymentMethod,
        total: sql<string>`SUM((${sales.total})::numeric)::text`,
        count: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(and(gte(sales.createdAt, start), lte(sales.createdAt, end)))
      .groupBy(sales.paymentMethod);
    return rows.map((r: any) => ({ paymentMethod: r.paymentMethod || 'UNKNOWN', total: parseFloat(r.total || '0'), count: Number(r.count || 0) }));
  }

  // Public helper to allow routes to trigger total recomputation when fields like discount change
  async recalculateSaleTotals(saleId: string): Promise<void> {
    await this.updateSaleTotals(saleId);
  }

  // Public helper to allow routes to trigger total recomputation for quotes (legacy data with missing shipping/tax)
  async recalculateQuoteTotals(quoteId: string): Promise<void> {
    await this.updateQuoteTotals(quoteId);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log(`[DEBUG] Searching for user with username: ${username}`);
      const result = await db
        .select()
        .from(users)
        .where(sql`${users.username} ILIKE ${username}`)
        .limit(1);
      return result[0];
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      console.log('[DEBUG] Creating user:', user.username);
      const result = await db.insert(users)
        .values({
          ...user,
          id: randomUUID(),
          createdAt: new Date(),
        })
        .returning();

      if (!result || result.length === 0) {
        throw new Error('Failed to create user');
      }

      console.log('[DEBUG] User created successfully:', result[0].id);
      return result[0];
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error;
    }
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await db.select().from(customers).where(eq(customers.id, id));
    return result[0];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const result = await db.insert(customers).values(customer).returning();
    return result[0];
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer> {
    const result = await db.update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Customer not found');
    }

    return result[0];
  }

  async deleteCustomer(id: string): Promise<boolean> {
    const result = await db.delete(customers).where(eq(customers.id, id)).returning();
    return result.length > 0;
  }

  // Finance
  async getFinanceEntries(): Promise<Finance[]> {
    try {
      console.log('getFinanceEntries: Iniciando consulta...');
      // Select only columns that are guaranteed to exist across versions
      const rows = await db
        .select({
          id: finance.id,
          entryType: finance.entryType,
          status: finance.status,
          date: finance.date,
          dueDate: finance.dueDate,
          description: finance.description,
          partyName: finance.partyName,
          customerId: finance.customerId,
          supplierId: finance.supplierId,
          saleId: finance.saleId,
          amount: finance.amount,
          paidAt: finance.paidAt,
          paymentMethod: finance.paymentMethod,
          recurrence: finance.recurrence,
          category: finance.category,
          costCenter: finance.costCenter,
          project: finance.project,
          projectId: finance.projectId,
          notes: finance.notes,
          linkFinanceId: finance.linkFinanceId,
          createdAt: finance.createdAt,
        })
        .from(finance)
        .orderBy(desc(finance.createdAt));
      console.log('getFinanceEntries: Consulta concluída, registros encontrados:', rows.length);
      return rows as unknown as Finance[];
    } catch (error) {
      console.error('getFinanceEntries: Erro na consulta:', error);
      throw error;
    }
  }

  async getFinanceEntry(id: string): Promise<Finance | undefined> {
    const rows = await db
      .select({
        id: finance.id,
        entryType: finance.entryType,
        status: finance.status,
        date: finance.date,
        dueDate: finance.dueDate,
        description: finance.description,
        partyName: finance.partyName,
        customerId: finance.customerId,
        supplierId: finance.supplierId,
        saleId: finance.saleId,
        amount: finance.amount,
        paidAt: finance.paidAt,
        paymentMethod: finance.paymentMethod,
        recurrence: finance.recurrence,
        category: finance.category,
        costCenter: finance.costCenter,
        project: finance.project,
        projectId: finance.projectId,
        notes: finance.notes,
        linkFinanceId: finance.linkFinanceId,
        createdAt: finance.createdAt,
      })
      .from(finance)
      .where(eq(finance.id, id));
    return (rows as unknown as Finance[])[0];
  }

  async createFinanceEntry(data: InsertFinance): Promise<Finance> {
    // Generate code if not provided
    let code = (data as any).code;
    if (!code) {
      const prefix = data.entryType === 'RECEIVABLE' ? 'REC' : (data.entryType === 'PAYABLE' ? 'PAG' : 'CX');

      // Get the count of existing entries of this type
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(finance)
        .where(eq(finance.entryType, data.entryType));

      const count = (countResult[0]?.count || 0) + 1;
      code = `${prefix}-${String(count).padStart(5, '0')}`;
    }

    try {
      const result = await db
        .insert(finance)
        .values({ ...data, code } as any)
        .returning({
          id: finance.id,
          entryType: finance.entryType,
          status: finance.status,
          date: finance.date,
          dueDate: finance.dueDate,
          description: finance.description,
          partyName: finance.partyName,
          customerId: finance.customerId,
          supplierId: finance.supplierId,
          saleId: finance.saleId,
          amount: finance.amount,
          paidAt: finance.paidAt,
          paymentMethod: finance.paymentMethod,
          recurrence: finance.recurrence,
          category: finance.category,
          costCenter: finance.costCenter,
          project: finance.project,
          projectId: finance.projectId,
          notes: finance.notes,
          linkFinanceId: finance.linkFinanceId,
          createdAt: finance.createdAt,
        });
      return result[0] as unknown as Finance;
    } catch (e: any) {
      // Fallback for older DBs without 'code' column
      if (String(e?.message || e).toLowerCase().includes('column') && String(e?.message || e).toLowerCase().includes('code')) {
        const { code: _drop, ...rest } = (data as any) || {};
        const result = await db
          .insert(finance)
          .values(rest as any)
          .returning({
            id: finance.id,
            entryType: finance.entryType,
            status: finance.status,
            date: finance.date,
            dueDate: finance.dueDate,
            description: finance.description,
            partyName: finance.partyName,
            customerId: finance.customerId,
            supplierId: finance.supplierId,
            saleId: finance.saleId,
            amount: finance.amount,
            paidAt: finance.paidAt,
            paymentMethod: finance.paymentMethod,
            recurrence: finance.recurrence,
            category: finance.category,
            costCenter: finance.costCenter,
            project: finance.project,
            projectId: finance.projectId,
            notes: finance.notes,
            linkFinanceId: finance.linkFinanceId,
            createdAt: finance.createdAt,
          });
        return result[0] as unknown as Finance;
      }
      throw e;
    }
  }

  async updateFinanceEntry(id: string, data: Partial<InsertFinance>): Promise<Finance> {
    // Avoid setting 'code' for compatibility
    const { code: _ignored, ...rest } = (data as any) || {};
    try {
      const result = await db
        .update(finance)
        .set(rest as any)
        .where(eq(finance.id, id))
        .returning({
          id: finance.id,
          entryType: finance.entryType,
          status: finance.status,
          date: finance.date,
          dueDate: finance.dueDate,
          description: finance.description,
          partyName: finance.partyName,
          customerId: finance.customerId,
          supplierId: finance.supplierId,
          saleId: finance.saleId,
          amount: finance.amount,
          paidAt: finance.paidAt,
          paymentMethod: finance.paymentMethod,
          recurrence: finance.recurrence,
          category: finance.category,
          costCenter: finance.costCenter,
          project: finance.project,
          projectId: finance.projectId,
          notes: finance.notes,
          linkFinanceId: finance.linkFinanceId,
          createdAt: finance.createdAt,
        });
      if (result.length === 0) throw new Error('Finance entry not found');
      return result[0] as unknown as Finance;
    } catch (e: any) {
      if (String(e?.message || e).toLowerCase().includes('column') && String(e?.message || e).toLowerCase().includes('code')) {
        const result = await db
          .update(finance)
          .set(rest as any)
          .where(eq(finance.id, id))
          .returning({
            id: finance.id,
            entryType: finance.entryType,
            status: finance.status,
            date: finance.date,
            dueDate: finance.dueDate,
            description: finance.description,
            partyName: finance.partyName,
            customerId: finance.customerId,
            supplierId: finance.supplierId,
            saleId: finance.saleId,
            amount: finance.amount,
            paidAt: finance.paidAt,
            paymentMethod: finance.paymentMethod,
            recurrence: finance.recurrence,
            category: finance.category,
            costCenter: finance.costCenter,
            project: finance.project,
            projectId: finance.projectId,
            notes: finance.notes,
            linkFinanceId: finance.linkFinanceId,
            createdAt: finance.createdAt,
          });
        if (result.length === 0) throw new Error('Finance entry not found');
        return result[0] as unknown as Finance;
      }
      throw e;
    }
  }

  async deleteFinanceEntry(id: string): Promise<boolean> {
    const result = await db
      .delete(finance)
      .where(eq(finance.id, id))
      .returning({ id: finance.id });
    return result.length > 0;
  }

  async markPaidWithCashMovement(id: string, payload: { date: Date; paymentMethod?: string | null; notes?: string | null }): Promise<{ updated: Finance; cash: Finance }> {
    // Buscar lançamento
    const current = await this.getFinanceEntry(id);
    if (!current) throw new Error('Finance entry not found');

    // Atualizar como pago
    const updated = await this.updateFinanceEntry(id, { status: 'PAID' as any, paidAt: payload.date });

    // Inserir movimento de caixa vinculado
    const cashAmount = (updated.entryType === 'RECEIVABLE') ? updated.amount : (0 - Number(updated.amount)) as any;
    const cashInsert: InsertFinance = {
      entryType: 'CASH' as any,
      status: 'PAID' as any,
      date: payload.date,
      dueDate: payload.date,
      description: updated.description || (updated.entryType === 'RECEIVABLE' ? `Recebimento - ${updated.partyName || ''}` : `Pagamento - ${updated.partyName || ''}`),
      partyName: updated.partyName as any,
      customerId: updated.customerId as any,
      supplierId: updated.supplierId as any,
      saleId: (updated as any).saleId,
      amount: cashAmount,
      paidAt: payload.date,
      paymentMethod: payload.paymentMethod || (updated as any).paymentMethod,
      recurrence: null as any,
      category: (updated as any).category,
      costCenter: (updated as any).costCenter,
      project: (updated as any).project,
      notes: payload.notes || (updated as any).notes,
      linkFinanceId: updated.id as any,
    } as any;

    const cash = await this.createFinanceEntry(cashInsert);
    return { updated, cash };
  }

  // Company Settings
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const all = await db.select().from(companySettings);
    return all[0];
  }

  async upsertCompanySettings(data: InsertCompanySettings): Promise<CompanySettings> {
    // Upsert by CNPJ (unique)
    const existing = await db.select().from(companySettings).where(eq(companySettings.cnpj, data.cnpj));
    if (existing.length) {
      const updated = await db
        .update(companySettings)
        .set(data)
        .where(eq(companySettings.id, existing[0].id))
        .returning();
      return updated[0];
    }
    const inserted = await db.insert(companySettings).values(data).returning();
    return inserted[0];
  }

  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers);
  }

  async getSupplier(id: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return result[0];
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const result = await db.insert(suppliers).values(supplier).returning();
    return result[0];
  }

  async updateSupplier(id: string, supplier: Partial<InsertSupplier>): Promise<Supplier> {
    const result = await db.update(suppliers)
      .set(supplier)
      .where(eq(suppliers.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Supplier not found');
    }

    return result[0];
  }

  async deleteSupplier(id: string): Promise<boolean> {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    return result.length > 0;
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id));
    return result[0];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    const result = await db.update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Category not found');
    }

    return result[0];
  }

  async deleteCategory(id: string): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  // Segments
  async getSegments(): Promise<Segment[]> {
    return await db.select().from(segments);
  }

  async getSegment(id: string): Promise<Segment | undefined> {
    const result = await db.select().from(segments).where(eq(segments.id, id));
    return result[0];
  }

  async createSegment(segment: InsertSegment): Promise<Segment> {
    const result = await db.insert(segments).values(segment).returning();
    return result[0];
  }

  async updateSegment(id: string, segment: Partial<InsertSegment>): Promise<Segment> {
    const result = await db.update(segments)
      .set(segment)
      .where(eq(segments.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Segment not found');
    }

    return result[0];
  }

  async deleteSegment(id: string): Promise<boolean> {
    const result = await db.delete(segments).where(eq(segments.id, id)).returning();
    return result.length > 0;
  }

  // Products
  async getProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    // Gerar sempre um código interno de 6 dígitos numéricos aleatórios (único)
    const maxAttempts = 50;
    let code: string | null = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidate = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
      const exists = await db.select().from(products).where(eq(products.code, candidate));
      if (exists.length === 0) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      // Fallback muito improvável
      code = String(Date.now()).slice(-6).padStart(6, '0');
    }

    const result = await db.insert(products).values({ ...product, code } as any).returning();
    return result[0];
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    // Fetch current to detect cost changes
    const currentRows = await db.select().from(products).where(eq(products.id, id));
    if (currentRows.length === 0) {
      throw new Error('Product not found');
    }
    const current = currentRows[0];

    const result = await db.update(products)
      .set(product)
      .where(eq(products.id, id))
      .returning();

    const updated = result[0];

    // If costPrice changed, record in history (drizzle decimals are strings)
    if (product.costPrice !== undefined && String(current.costPrice) !== String(product.costPrice)) {
      const oldCost = current.costPrice as any;
      const newCost = (product.costPrice as any);
      await db.insert(productPriceHistory).values({
        productId: id,
        oldCostPrice: oldCost,
        newCostPrice: newCost,
      } as any);
    }

    return updated;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id)).returning();
    return result.length > 0;
  }

  async getLowStockProducts(): Promise<Product[]> {
    return await db.select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          lte(products.currentStock, products.minimumStock)
        )
      );
  }

  // Inventory
  async getInventoryMovements(): Promise<Inventory[]> {
    return await db.select().from(inventory).orderBy(desc(inventory.createdAt));
  }

  async getInventoryMovementsByProduct(productId: string): Promise<Inventory[]> {
    return await db.select()
      .from(inventory)
      .where(eq(inventory.productId, productId))
      .orderBy(desc(inventory.createdAt));
  }

  async getInventoryMovement(id: string): Promise<Inventory | undefined> {
    const result = await db.select().from(inventory).where(eq(inventory.id, id));
    return result[0];
  }

  async createInventoryMovement(movement: InsertInventory): Promise<Inventory> {
    // Atualizar o estoque do produto
    const product = await this.getProduct(movement.productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // currentStock pode ser null no TS; tratar como 0
    let newStock = (product.currentStock ?? 0);
    if (movement.type === 'IN') {
      newStock += movement.quantity;
    } else if (movement.type === 'OUT') {
      newStock -= movement.quantity;
    } else if (movement.type === 'ADJUSTMENT') {
      newStock = movement.quantity;
    }

    // Atualizar o produto
    await this.updateProduct(product.id, { currentStock: newStock });

    // Registrar o movimento
    const result = await db.insert(inventory).values(movement).returning();
    return result[0];
  }

  async updateInventoryMovement(id: string, movement: Partial<InsertInventory>): Promise<Inventory> {
    const result = await db.update(inventory).set(movement as any).where(eq(inventory.id, id)).returning();
    if (result.length === 0) throw new Error('Inventory movement not found');
    return result[0];
  }

  async deleteInventoryMovement(id: string): Promise<boolean> {
    const result = await db.delete(inventory).where(eq(inventory.id, id)).returning();
    return result.length > 0;
  }

  // Quotes
  async getQuotes(): Promise<Quote[]> {
    return await db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async getQuote(id: string): Promise<Quote | undefined> {
    const result = await db.select().from(quotes).where(eq(quotes.id, id));
    return result[0];
  }

  async getQuoteByNumber(number: string): Promise<Quote | undefined> {
    const result = await db.select().from(quotes).where(eq(quotes.number, number));
    return result[0];
  }

  async createQuote(quote: InsertQuote): Promise<Quote> {
    // Gerar número sequencial para o orçamento
    const allQuotes = await this.getQuotes();
    const quoteNumber = `ORC${String(allQuotes.length + 1).padStart(6, '0')}`;

    const result = await db.insert(quotes)
      .values({ ...quote, number: quoteNumber })
      .returning();

    return result[0];
  }

  async updateQuote(id: string, quote: Partial<InsertQuote>): Promise<Quote> {
    const result = await db.update(quotes)
      .set(quote)
      .where(eq(quotes.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Quote not found');
    }
    // Recalcular totais para refletir mudanças em desconto, impostos ou frete
    await this.updateQuoteTotals(id);
    return result[0];
  }

  async deleteQuote(id: string): Promise<boolean> {
    // Primeiro excluir os itens do orçamento
    await db.delete(quoteItems).where(eq(quoteItems.quoteId, id));

    // Depois excluir o orçamento
    const result = await db.delete(quotes).where(eq(quotes.id, id)).returning();
    return result.length > 0;
  }

  // Quote Attachments
  async getQuoteAttachments(quoteId: string): Promise<QuoteAttachment[]> {
    return await db.select().from(quoteAttachments)
      .where(eq(quoteAttachments.quoteId, quoteId))
      .orderBy(desc(quoteAttachments.uploadedAt));
  }

  async getQuoteAttachment(id: string): Promise<QuoteAttachment | undefined> {
    const result = await db.select().from(quoteAttachments).where(eq(quoteAttachments.id, id));
    return result[0];
  }

  async addQuoteAttachment(data: InsertQuoteAttachment) {
    const [attachment] = await db
      .insert(quoteAttachments)
      .values({
        ...data,
        id: randomUUID(),
      })
      .returning();

    if (!attachment) {
      throw new Error('Failed to add quote attachment');
    }

    return attachment;
  }

  async deleteQuoteAttachment(id: string) {
    const [attachment] = await db
      .delete(quoteAttachments)
      .where(eq(quoteAttachments.id, id))
      .returning();

    return !!attachment;
  }

  // Quote Items
  async getQuoteItems(quoteId: string): Promise<QuoteItem[]> {
    return await db.select()
      .from(quoteItems)
      .where(eq(quoteItems.quoteId, quoteId));
  }

  async getQuoteItemById(id: string): Promise<QuoteItem | undefined> {
    const result = await db.select()
      .from(quoteItems)
      .where(eq(quoteItems.id, id));
    return result[0];
  }

  async createQuoteItem(item: InsertQuoteItem): Promise<QuoteItem> {
    const result = await db.insert(quoteItems).values(item).returning();

    // Atualizar o total do orçamento
    await this.updateQuoteTotals(item.quoteId);

    return result[0];
  }

  async updateQuoteItem(id: string, item: Partial<InsertQuoteItem>): Promise<QuoteItem> {
    const currentItem = await db.select()
      .from(quoteItems)
      .where(eq(quoteItems.id, id));

    if (currentItem.length === 0) {
      throw new Error('Quote item not found');
    }

    const result = await db.update(quoteItems)
      .set(item)
      .where(eq(quoteItems.id, id))
      .returning();

    // Atualizar o total do orçamento
    await this.updateQuoteTotals(currentItem[0].quoteId);

    return result[0];
  }

  async deleteQuoteItem(id: string): Promise<boolean> {
    const item = await db.select()
      .from(quoteItems)
      .where(eq(quoteItems.id, id));

    if (item.length === 0) {
      return false;
    }

    const quoteId = item[0].quoteId;

    const result = await db.delete(quoteItems)
      .where(eq(quoteItems.id, id))
      .returning();

    // Atualizar o total do orçamento
    await this.updateQuoteTotals(quoteId);

    return result.length > 0;
  }

  // Função auxiliar para atualizar os totais do orçamento
  private async updateQuoteTotals(quoteId: string): Promise<void> {
    const items = await this.getQuoteItems(quoteId);

    const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);

    const quote = await this.getQuote(quoteId);
    if (!quote) return;

    const discount = Number(quote.discount) || 0;
    const taxTotal = Number((quote as any).taxTotal) || 0;
    const shipping = Number((quote as any).shipping) || 0;
    const total = subtotal - discount + taxTotal + shipping;

    // Drizzle decimal columns are represented as strings in TS; persist as strings
    const subtotalStr = subtotal.toFixed(2);
    const totalStr = total.toFixed(2);

    await db.update(quotes)
      .set({ subtotal: subtotalStr, total: totalStr })
      .where(eq(quotes.id, quoteId));
  }

  // Sales
  async getSaleByNumber(number: string): Promise<Sale | undefined> {
    const result = await db.select().from(sales).where(eq(sales.number, number));
    return result[0];
  }

  async getSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.createdAt));
  }

  async getSale(id: string): Promise<Sale | undefined> {
    const result = await db.select().from(sales).where(eq(sales.id, id));
    return result[0];
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    // Gerar número sequencial para a venda
    const allSales = await this.getSales();
    const saleNumber = `VDA${String(allSales.length + 1).padStart(6, '0')}`;

    // Extrair itens do payload se fornecidos
    const items = (sale as any).items || [];
    const saleData = { ...sale };
    delete (saleData as any).items; // Remover itens do payload da venda

    const result = await db.insert(sales)
      .values({ ...saleData, number: saleNumber })
      .returning();

    const created = result[0];

    // Se há itens fornecidos no payload, criar eles primeiro
    if (items.length > 0) {
      try {
        console.log(`[createSale] Criando ${items.length} itens fornecidos para venda ${created.id}`);

        for (const item of items) {
          await this.createSaleItem({
            saleId: created.id,
            productId: item.productId || null,
            serviceDescription: item.serviceDescription || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount || '0',
            total: item.total,
          });
        }

        // Atualizar totais da venda
        await this.updateSaleTotals(created.id);
        console.log(`[createSale] Itens fornecidos criados com sucesso para venda ${created.id}`);
      } catch (e) {
        console.error('[createSale] Falha ao criar itens fornecidos para a venda', e);
        // Não falhar a criação da venda se a criação de itens falhar
      }
    }
    // Se não há itens fornecidos mas há quoteId, copiar itens do orçamento
    else if (created.quoteId) {
      try {
        const qItems = await this.getQuoteItems(created.quoteId);
        if (qItems.length > 0) {
          console.log(`[createSale] Copiando ${qItems.length} itens do orçamento ${created.quoteId} para venda ${created.id}`);

          // Inserir itens correspondentes na venda usando createSaleItem para garantir movimentos de estoque
          for (const qi of qItems) {
            await this.createSaleItem({
              saleId: created.id,
              productId: qi.productId ?? undefined,
              serviceDescription: qi.serviceDescription ?? undefined,
              quantity: qi.quantity,
              unitPrice: qi.unitPrice,
              discount: qi.discount ?? '0',
              total: qi.total,
            });
          }
          // Totais já são atualizados dentro de createSaleItem, mas garantimos consistência
          await this.updateSaleTotals(created.id);
          console.log(`[createSale] Itens copiados com sucesso para venda ${created.id}`);
        }
      } catch (e) {
        // Não falhar a criação da venda se a cópia de itens falhar; apenas prosseguir
        console.error('[createSale] Falha ao copiar itens do orçamento para a venda', e);
      }
    }

    // Se a venda foi criada a partir de um orçamento, atualizar o status do orçamento
    if (sale.quoteId) {
      await db.update(quotes)
        .set({ status: 'CONVERTED' })
        .where(eq(quotes.id, sale.quoteId));
    }

    return result[0];
  }

  async updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale> {
    const result = await db.update(sales)
      .set(sale)
      .where(eq(sales.id, id))
      .returning();

    if (result.length === 0) {
      throw new Error('Sale not found');
    }

    return result[0];
  }

  async deleteSale(id: string): Promise<boolean> {
    // Primeiro excluir os itens da venda
    await db.delete(saleItems).where(eq(saleItems.saleId, id));

    // Depois excluir a venda
    const result = await db.delete(sales).where(eq(sales.id, id)).returning();
    return result.length > 0;
  }

  // Sale Items
  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    return await db.select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId));
  }

  async getSaleItemById(id: string): Promise<SaleItem | undefined> {
    const result = await db.select()
      .from(saleItems)
      .where(eq(saleItems.id, id));
    return result[0];
  }

  async createSaleItem(item: InsertSaleItem): Promise<SaleItem> {
    const result = await db.insert(saleItems).values(item).returning();

    // Atualizar o total da venda
    await this.updateSaleTotals(item.saleId);

    // Atualizar o estoque do produto somente quando houver productId (não é serviço)
    if (item.productId) {
      // Registrar movimento de saída no inventário (responsável por ajustar o estoque)
      await this.createInventoryMovement({
        productId: item.productId,
        type: 'OUT',
        quantity: item.quantity,
        reason: `Venda: ${item.saleId}`,
        userId: null
      });
    }

    return result[0];
  }

  async updateSaleItem(id: string, item: Partial<InsertSaleItem>): Promise<SaleItem> {
    const currentItem = await db.select()
      .from(saleItems)
      .where(eq(saleItems.id, id));

    if (currentItem.length === 0) {
      throw new Error('Sale item not found');
    }

    // Se a quantidade foi alterada, registrar movimento no estoque (apenas para itens com produto)
    if (item.quantity !== undefined && item.quantity !== currentItem[0].quantity && currentItem[0].productId) {
      const quantityDiff = item.quantity - currentItem[0].quantity;
      // Movimento de saída se aumentou a quantidade; entrada se diminuiu
      await this.createInventoryMovement({
        productId: currentItem[0].productId,
        type: quantityDiff > 0 ? 'OUT' : 'IN',
        quantity: Math.abs(quantityDiff),
        reason: `Ajuste na venda: ${currentItem[0].saleId}`,
        userId: null
      });
    }

    const result = await db.update(saleItems)
      .set(item)
      .where(eq(saleItems.id, id))
      .returning();

    // Atualizar o total da venda
    await this.updateSaleTotals(currentItem[0].saleId);

    return result[0];
  }

  async deleteSaleItem(id: string): Promise<boolean> {
    const item = await db.select()
      .from(saleItems)
      .where(eq(saleItems.id, id));

    if (item.length === 0) {
      return false;
    }

    const saleId = item[0].saleId;

    // Devolver o item ao estoque somente para itens de produto (via movimento de inventário)
    if (item[0].productId) {
      await this.createInventoryMovement({
        productId: item[0].productId,
        type: 'IN',
        quantity: item[0].quantity,
        reason: `Remoção de item da venda: ${saleId}`,
        userId: null
      });
    }

    const result = await db.delete(saleItems)
      .where(eq(saleItems.id, id))
      .returning();

    // Atualizar o total da venda
    await this.updateSaleTotals(saleId);

    return result.length > 0;
  }

  // Função auxiliar para atualizar os totais da venda
  private async updateSaleTotals(saleId: string): Promise<void> {
    const items = await this.getSaleItems(saleId);

    const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);

    const sale = await this.getSale(saleId);
    if (!sale) return;

    const discount = Number(sale.discount) || 0;
    const total = subtotal - discount;

    // Drizzle decimal columns are represented as strings in TS; persist as strings
    const subtotalStr = subtotal.toFixed(2);
    const totalStr = total.toFixed(2);

    await db.update(sales)
      .set({ subtotal: subtotalStr, total: totalStr })
      .where(eq(sales.id, saleId));
  }

  // Appointments (Agenda)
  async getAppointments(): Promise<Appointment[]> {
    return await db.select().from(appointments).orderBy(desc(appointments.date));
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    const result = await db.select().from(appointments).where(eq(appointments.id, id));
    return result[0];
  }

  async createAppointment(a: InsertAppointment): Promise<Appointment> {
    const result = await db.insert(appointments).values(a).returning();
    return result[0];
  }

  async updateAppointment(id: string, a: Partial<InsertAppointment>): Promise<Appointment> {
    const result = await db.update(appointments)
      .set(a)
      .where(eq(appointments.id, id))
      .returning();
    if (result.length === 0) {
      throw new Error('Appointment not found');
    }
    return result[0];
  }

  async deleteAppointment(id: string): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id)).returning();
    return result.length > 0;
  }

  // Dashboard metrics
  async getDashboardMetrics(): Promise<{
    dailySales: number;
    pendingQuotes: number;
    totalProducts: number;
    activeCustomers: number;
    lowStockItems: number;
  }> {
    // Obter vendas do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const salesResult = await this.getSales();
    const dailySales = salesResult
      .filter(sale => {
        if (!sale.createdAt) return false;
        const saleDate = new Date(sale.createdAt);
        saleDate.setHours(0, 0, 0, 0);
        return saleDate.getTime() === today.getTime() && sale.status === 'COMPLETED';
      })
      .reduce((sum, sale) => sum + Number(sale.total), 0);

    // Obter orçamentos pendentes
    const quotesResult = await this.getQuotes();
    const pendingQuotes = quotesResult.filter(quote => quote.status === 'PENDING').length;

    // Obter total de produtos
    const productsResult = await this.getProducts();
    const totalProducts = productsResult.length;

    // Obter clientes ativos
    const customersResult = await this.getCustomers();
    const activeCustomers = customersResult.filter(customer => customer.isActive).length;

    // Obter produtos com estoque baixo
    const lowStockResult = await this.getLowStockProducts();
    const lowStockItems = lowStockResult.length;

    return {
      dailySales,
      pendingQuotes,
      totalProducts,
      activeCustomers,
      lowStockItems
    };
  }

  // Projects
  async getProjects(): Promise<Project[]> {
    try {
      const result = await db
        .select({
          id: projects.id,
          code: projects.code,
          name: projects.name,
          description: projects.description,
          customerId: projects.customerId,
          customerName: customers.name,
          quoteId: projects.quoteId,
          saleId: projects.saleId,
          status: projects.status,
          startDate: projects.startDate,
          expectedEndDate: projects.expectedEndDate,
          endDate: projects.endDate,
          budget: projects.budget,
          progress: projects.progress,
          createdAt: projects.createdAt,
        })
        .from(projects)
        .leftJoin(customers, eq(projects.customerId, customers.id))
        // Order by custom priority for status: IN_PROGRESS, PLANNING, ON_HOLD, COMPLETED, CANCELLED
        .orderBy(
          // Use SQL CASE to map statuses to numeric priority
          sql`CASE WHEN ${projects.status} = 'IN_PROGRESS' THEN 0 WHEN ${projects.status} = 'PLANNING' THEN 1 WHEN ${projects.status} = 'ON_HOLD' THEN 2 WHEN ${projects.status} = 'COMPLETED' THEN 3 WHEN ${projects.status} = 'CANCELLED' THEN 4 ELSE 5 END`,
          desc(projects.createdAt)
        );

      const projectsWithCalculations = await Promise.all(
        result.map(async (row: any) => {
          const tasks = await this.getProjectTasks(row.id);
          const expenses = await this.getProjectExpenses(row.id);

          const tasksCost = (tasks || []).reduce((acc: number, t: any) => acc + Number(t.cost || 0), 0);
          const expensesTotal = (expenses || []).reduce((acc: number, e: any) => acc + Number(e.amount || 0), 0);
          const totalCost = tasksCost + expensesTotal;

          let totalRevenue = 0;
          if (row.quoteId) {
            const quote = await this.getQuote(row.quoteId);
            if (quote?.total) totalRevenue = Number(quote.total);
          } else if (row.saleId) {
            const sale = await this.getSale(row.saleId);
            if (sale?.total) totalRevenue = Number(sale.total);
          }

          return {
            ...row,
            totalCost,
            totalRevenue,
            expectedEndDate: row.expectedEndDate,
          };
        })
      );

      return projectsWithCalculations as Project[];
    } catch (e: any) {
      console.error('[Projects] getProjects error:', e?.message || e);
      throw e;
    }
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db
      .select({
        id: projects.id,
        code: projects.code,
        name: projects.name,
        description: projects.description,
        customerId: projects.customerId,
        customerName: customers.name,
        quoteId: projects.quoteId,
        saleId: projects.saleId,
        status: projects.status,
        startDate: projects.startDate,
        expectedEndDate: projects.expectedEndDate,
        endDate: projects.endDate,
        budget: projects.budget,
        progress: projects.progress,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(customers, eq(projects.customerId, customers.id))
      .where(eq(projects.id, id));

    if (!result[0]) return undefined;

    return {
      ...result[0],
      totalCost: null,
      totalRevenue: null,
      expectedEndDate: result[0].expectedEndDate,
    } as Project;
  }

  async createProject(data: InsertProject): Promise<Project> {
    // auto-generate code if not provided: PJT000001
    let code = (data as any).code?.trim();
    if (!code) {
      const existing = await db.select().from(projects);
      let counter = existing.length + 1;
      while (true) {
        const candidate = `PJT${String(counter).padStart(6, '0')}`;
        if (!existing.find((p: any) => p.code === candidate)) { code = candidate; break; }
        counter++;
      }
    }
    const result = await db.insert(projects).values({ ...(data as any), code }).returning();
    return result[0];
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project> {
    const result = await db.update(projects).set(data as any).where(eq(projects.id, id)).returning();
    if (!result.length) throw new Error('Project not found');
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    await db.delete(projectTasks).where(eq(projectTasks.projectId, id));
    await db.delete(projectExpenses).where(eq(projectExpenses.projectId, id));
    await db.delete(projectDocuments).where(eq(projectDocuments.projectId, id));
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  // Project Tasks
  async getProjectTasks(projectId: string): Promise<ProjectTask[]> {
    return await db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(desc(projectTasks.createdAt));
  }
  async createProjectTask(data: InsertProjectTask): Promise<ProjectTask> {
    const result = await db.insert(projectTasks).values(data as any).returning();
    return result[0];
  }
  async updateProjectTask(id: string, data: Partial<InsertProjectTask>): Promise<ProjectTask> {
    const result = await db.update(projectTasks).set(data as any).where(eq(projectTasks.id, id)).returning();
    if (!result.length) throw new Error('Project task not found');
    return result[0];
  }
  async deleteProjectTask(id: string): Promise<boolean> {
    const result = await db.delete(projectTasks).where(eq(projectTasks.id, id)).returning();
    return result.length > 0;
  }

  // Project Expenses
  async getProjectExpenses(projectId: string): Promise<ProjectExpense[]> {
    return await db.select().from(projectExpenses).where(eq(projectExpenses.projectId, projectId)).orderBy(desc(projectExpenses.createdAt));
  }
  async createProjectExpense(data: InsertProjectExpense): Promise<ProjectExpense> {
    const result = await db.insert(projectExpenses).values(data as any).returning();
    return result[0];
  }
  async updateProjectExpense(id: string, data: Partial<InsertProjectExpense>): Promise<ProjectExpense> {
    const result = await db.update(projectExpenses).set(data as any).where(eq(projectExpenses.id, id)).returning();
    if (!result.length) throw new Error('Project expense not found');
    return result[0];
  }
  async deleteProjectExpense(id: string): Promise<boolean> {
    const result = await db.delete(projectExpenses).where(eq(projectExpenses.id, id)).returning();
    return result.length > 0;
  }

  // Project Documents
  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    return await db.select().from(projectDocuments).where(eq(projectDocuments.projectId, projectId)).orderBy(desc(projectDocuments.uploadedAt));
  }
  async createProjectDocument(data: InsertProjectDocument): Promise<ProjectDocument> {
    const result = await db.insert(projectDocuments).values(data as any).returning();
    return result[0];
  }
  async deleteProjectDocument(id: string): Promise<boolean> {
    const result = await db.delete(projectDocuments).where(eq(projectDocuments.id, id)).returning();
    return result.length > 0;
  }

  // Purchase Requests
  async getPurchaseRequests(): Promise<PurchaseRequest[]> {
    return await db.select().from(purchaseRequests).orderBy(desc(purchaseRequests.createdAt));
  }

  async getPurchaseRequest(id: string): Promise<PurchaseRequest | undefined> {
    const result = await db.select().from(purchaseRequests).where(eq(purchaseRequests.id, id));
    return result[0];
  }

  async createPurchaseRequest(data: InsertPurchaseRequest): Promise<PurchaseRequest> {
    // Respect provided number; otherwise auto-generate PRQ000001 using max existing sequence
    let number = (data as any).number?.trim();
    if (!number) {
      const existing = await db.select({ number: purchaseRequests.number }).from(purchaseRequests);
      const prefix = 'PRQ';
      const pad = 6;
      const maxNum = existing
        .map((r: any) => r.number as string)
        .filter((n: any) => typeof n === 'string' && n.startsWith(prefix))
        .map((n: any) => parseInt(n.slice(prefix.length), 10))
        .filter((v: any) => !isNaN(v))
        .reduce((a: number, b: number) => Math.max(a, b), 0);
      const next = (maxNum + 1).toString().padStart(pad, '0');
      number = `${prefix}${next}`;
    }
    const result = await db.insert(purchaseRequests).values({ ...(data as any), number }).returning();
    return result[0];
  }

  async updatePurchaseRequest(id: string, data: Partial<InsertPurchaseRequest>): Promise<PurchaseRequest> {
    const result = await db.update(purchaseRequests).set(data as any).where(eq(purchaseRequests.id, id)).returning();
    if (!result.length) throw new Error('Purchase request not found');
    return result[0];
  }

  async getPurchaseRequestItems(requestId: string): Promise<PurchaseRequestItem[]> {
    return await db.select().from(purchaseRequestItems).where(eq(purchaseRequestItems.requestId, requestId));
  }

  async addPurchaseRequestItem(data: InsertPurchaseRequestItem): Promise<PurchaseRequestItem> {
    const result = await db.insert(purchaseRequestItems).values(data as any).returning();
    return result[0];
  }

  async updatePurchaseRequestItem(id: string, data: Partial<InsertPurchaseRequestItem>): Promise<PurchaseRequestItem> {
    const result = await db
      .update(purchaseRequestItems)
      .set(data as any)
      .where(eq(purchaseRequestItems.id, id))
      .returning();
    if (!result.length) throw new Error('Purchase request item not found');
    return result[0];
  }

  async removePurchaseRequestItem(id: string): Promise<boolean> {
    const result = await db.delete(purchaseRequestItems).where(eq(purchaseRequestItems.id, id)).returning();
    return result.length > 0;
  }

  async setPurchaseRequestStatus(id: string, status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'): Promise<PurchaseRequest> {
    const result = await db.update(purchaseRequests).set({ status } as any).where(eq(purchaseRequests.id, id)).returning();
    if (!result.length) throw new Error('Purchase request not found');
    return result[0];
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return await db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }
  async getContract(id: string): Promise<Contract | undefined> {
    const result = await db.select().from(contracts).where(eq(contracts.id, id));
    return result[0];
  }
  async createContract(data: InsertContract): Promise<Contract> {
    // Auto-generate number CTR000001 if not provided
    let number = (data as any).number?.trim();
    if (!number) {
      const existing = await db.select().from(contracts);
      let counter = existing.length + 1;
      while (true) {
        const candidate = `CTR${String(counter).padStart(6, '0')}`;
        if (!existing.find(c => c.number === candidate)) { number = candidate; break; }
        counter++;
      }
    }
    const result = await db.insert(contracts).values({ ...(data as any), number }).returning();
    return result[0];
  }
  async updateContract(id: string, data: Partial<InsertContract>): Promise<Contract> {
    const result = await db.update(contracts).set(data as any).where(eq(contracts.id, id)).returning();
    if (!result.length) throw new Error('Contract not found');
    return result[0];
  }
  async deleteContract(id: string): Promise<boolean> {
    // Remove documents then contract
    await db.delete(contractDocuments).where(eq(contractDocuments.contractId, id));
    const result = await db.delete(contracts).where(eq(contracts.id, id)).returning();
    return result.length > 0;
  }

  async getContractByNumber(number: string): Promise<Contract | undefined> {
    const result = await db.select().from(contracts).where(eq(contracts.number, number));
    return result[0];
  }


  // Contract Documents
  async getContractDocuments(contractId: string): Promise<ContractDocument[]> {
    return await db.select().from(contractDocuments).where(eq(contractDocuments.contractId, contractId)).orderBy(desc(contractDocuments.uploadedAt));
  }
  async addContractDocument(data: InsertContractDocument & { contractId: string }): Promise<ContractDocument> {
    const result = await db.insert(contractDocuments).values({ ...(data as any) }).returning();
    return result[0];
  }
  async deleteContractDocument(id: string): Promise<boolean> {
    const result = await db.delete(contractDocuments).where(eq(contractDocuments.id, id)).returning();
    return result.length > 0;
  }

  // Notes
  async getNotes(userId?: string): Promise<Note[]> {
    return await db.select()
      .from(notes)
      .where(userId ? eq(notes.userId, userId) : undefined)
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt));
  }

  async getNote(id: string): Promise<Note | undefined> {
    const result = await db.select().from(notes).where(eq(notes.id, id));
    return result[0];
  }

  async createNote(data: InsertNote): Promise<Note> {
    const noteData = {
      ...data,
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.insert(notes).values(noteData as any).returning();
    return result[0];
  }

  async updateNote(id: string, data: Partial<InsertNote>): Promise<Note> {
    const updateData = {
      ...data,
      updatedAt: new Date(),
    };
    const result = await db.update(notes).set(updateData as any).where(eq(notes.id, id)).returning();
    if (!result.length) throw new Error('Note not found');
    return result[0];
  }

  async deleteNote(id: string): Promise<boolean> {
    const result = await db.delete(notes).where(eq(notes.id, id)).returning();
    return result.length > 0;
  }

  async createContractDocument(data: InsertContractDocument): Promise<ContractDocument> {
    const result = await db.insert(contractDocuments).values(data as any).returning();
    return result[0];
  }

  // Cash Register methods
  async getCurrentCashRegister(): Promise<CashRegister | undefined> {
    const result = await db.select().from(cashRegisters)
      .where(eq(cashRegisters.status, 'OPEN'))
      .orderBy(desc(cashRegisters.openedAt))
      .limit(1);
    return result[0];
  }

  async getCashMovements(registerId: string): Promise<CashMovement[]> {
    return await db.select().from(cashMovements)
      .where(eq(cashMovements.registerId, registerId))
      .orderBy(desc(cashMovements.createdAt));
  }

  async openCashRegister(openingBalance: number): Promise<CashRegister> {
    const existingOpen = await this.getCurrentCashRegister();
    if (existingOpen) {
      throw new Error('Já existe um caixa aberto');
    }

    const registerData: any = {
      id: randomUUID(),
      code: `CX${Date.now()}`,
      name: 'Caixa Principal',
      status: 'OPEN',
      openedAt: new Date(),
      openingBalance: openingBalance.toFixed(2),
      currentBalance: openingBalance.toFixed(2),
      expectedBalance: openingBalance.toFixed(2),
    };

    const result = await db.insert(cashRegisters).values(registerData).returning();
    const register = result[0];

    // Register opening movement
    await db.insert(cashMovements).values({
      id: randomUUID(),
      registerId: register.id,
      type: 'OPENING',
      description: 'Abertura de caixa',
      amount: openingBalance.toFixed(2),
      createdAt: new Date(),
    });

    return register;
  }

  async closeCashRegister(closingBalance: number): Promise<CashRegister> {
    const register = await this.getCurrentCashRegister();
    if (!register) {
      throw new Error('Nenhum caixa aberto');
    }

    const difference = closingBalance - parseFloat(register.currentBalance || '0');

    const result = await db.update(cashRegisters)
      .set({
        status: 'CLOSED',
        closedAt: new Date(),
        closingBalance: closingBalance.toFixed(2),
        difference: difference.toFixed(2),
      })
      .where(eq(cashRegisters.id, register.id))
      .returning();

    // Register closing movement
    await db.insert(cashMovements).values({
      id: randomUUID(),
      registerId: register.id,
      type: 'CLOSING',
      description: `Fechamento de caixa - Diferença: ${difference.toFixed(2)}`,
      amount: closingBalance.toFixed(2),
      createdAt: new Date(),
    });

    return result[0];
  }

  async addCashMovement(type: string, amount: number, description?: string): Promise<CashMovement> {
    const register = await this.getCurrentCashRegister();
    if (!register) {
      throw new Error('Nenhum caixa aberto');
    }

    const movementData: any = {
      id: randomUUID(),
      registerId: register.id,
      type,
      description: description || type,
      amount: amount.toFixed(2),
      createdAt: new Date(),
    };

    const result = await db.insert(cashMovements).values(movementData).returning();

    // Update current balance: inflows add, outflows subtract
    const currentBalance = parseFloat(register.currentBalance || '0');
    const inflowTypes = new Set(['REINFORCEMENT', 'SALE', 'DEPOSIT', 'IN', 'ADJUST_IN']);
    const outflowTypes = new Set(['WITHDRAWAL', 'EXPENSE', 'CHANGE', 'OUT', 'ADJUST_OUT']);
    let newBalance = currentBalance;
    if (inflowTypes.has(type)) {
      newBalance = currentBalance + amount;
    } else if (outflowTypes.has(type)) {
      newBalance = currentBalance - amount;
    } else {
      // Default: treat positive amounts as inflow, negative as outflow
      newBalance = currentBalance + (amount >= 0 ? amount : amount);
    }

    await db.update(cashRegisters)
      .set({
        currentBalance: newBalance.toFixed(2),
        expectedBalance: newBalance.toFixed(2),
      })
      .where(eq(cashRegisters.id, register.id));

    return result[0];
  }
}