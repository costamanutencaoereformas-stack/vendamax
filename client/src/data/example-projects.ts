  import { formatISO } from 'date-fns';

export interface Project {
  id: string;
  code: string;
  name: string;
  customerId: string | null;
  customerName?: string | null;
  quoteId?: string | null;
  saleId?: string | null;
  status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
  startDate: string | null;
  endDate: string | null;
  expectedEndDate: string | null;
  totalCost: number | null;
  totalRevenue: number | null;
  createdAt: string;
}

const today = new Date();
const oneMonthAgo = new Date(today);
oneMonthAgo.setMonth(today.getMonth() - 1);

const twoMonthsAgo = new Date(today);
twoMonthsAgo.setMonth(today.getMonth() - 2);

const threeMonthsAgo = new Date(today);
threeMonthsAgo.setMonth(today.getMonth() - 3);

const oneMonthLater = new Date(today);
oneMonthLater.setMonth(today.getMonth() + 1);

const twoMonthsLater = new Date(today);
twoMonthsLater.setMonth(today.getMonth() + 2);

const threeMonthsLater = new Date(today);
threeMonthsLater.setMonth(today.getMonth() + 3);

export const exampleProjects: Project[] = [
  {
    id: "proj-001",
    code: "P2023-001",
    name: "Desenvolvimento de Website Corporativo",
    customerId: "cust-001",
    customerName: "Empresa ABC Ltda",
    status: "COMPLETED",
    startDate: formatISO(threeMonthsAgo),
    endDate: formatISO(oneMonthAgo),
    expectedEndDate: formatISO(oneMonthAgo),
    totalCost: 15000,
    totalRevenue: 25000,
    createdAt: formatISO(threeMonthsAgo),
  },
  {
    id: "proj-002",
    code: "P2023-002",
    name: "Sistema de Gestão de Estoque",
    customerId: "cust-002",
    customerName: "Distribuidora XYZ",
    status: "IN_PROGRESS",
    startDate: formatISO(twoMonthsAgo),
    endDate: null,
    expectedEndDate: formatISO(oneMonthLater),
    totalCost: 22000,
    totalRevenue: 35000,
    createdAt: formatISO(twoMonthsAgo),
  },
  {
    id: "proj-003",
    code: "P2023-003",
    name: "Aplicativo Mobile de Vendas",
    customerId: "cust-003",
    customerName: "Comércio Rápido S.A.",
    status: "PLANNING",
    startDate: null,
    endDate: null,
    expectedEndDate: formatISO(twoMonthsLater),
    totalCost: 30000,
    totalRevenue: 45000,
    createdAt: formatISO(oneMonthAgo),
  },
  {
    id: "proj-004",
    code: "P2023-004",
    name: "Integração de Sistemas Legados",
    customerId: "cust-001",
    customerName: "Empresa ABC Ltda",
    status: "ON_HOLD",
    startDate: formatISO(oneMonthAgo),
    endDate: null,
    expectedEndDate: formatISO(twoMonthsLater),
    totalCost: 18000,
    totalRevenue: 27000,
    createdAt: formatISO(oneMonthAgo),
  },
  {
    id: "proj-005",
    code: "P2023-005",
    name: "Plataforma de E-learning",
    customerId: "cust-004",
    customerName: "Instituto Educacional",
    status: "CANCELLED",
    startDate: formatISO(threeMonthsAgo),
    endDate: formatISO(twoMonthsAgo),
    expectedEndDate: formatISO(oneMonthLater),
    totalCost: 8000,
    totalRevenue: 20000,
    createdAt: formatISO(threeMonthsAgo),
  },
  {
    id: "proj-006",
    code: "P2023-006",
    name: "Dashboard de Análise de Dados",
    customerId: "cust-005",
    customerName: "Consultoria Estratégica",
    status: "IN_PROGRESS",
    startDate: formatISO(oneMonthAgo),
    endDate: null,
    expectedEndDate: formatISO(oneMonthLater),
    totalCost: 12000,
    totalRevenue: 18000,
    createdAt: formatISO(oneMonthAgo),
  },
  {
    id: "proj-007",
    code: "P2023-007",
    name: "Sistema de Automação Industrial",
    customerId: "cust-006",
    customerName: "Indústria Metalúrgica",
    status: "PLANNING",
    startDate: null,
    endDate: null,
    expectedEndDate: formatISO(threeMonthsLater),
    totalCost: 50000,
    totalRevenue: 75000,
    createdAt: formatISO(today),
  },
  {
    id: "proj-008",
    code: "P2023-008",
    name: "Aplicativo de Gestão Financeira",
    customerId: "cust-007",
    customerName: "Banco Digital",
    status: "IN_PROGRESS",
    startDate: formatISO(twoMonthsAgo),
    endDate: null,
    expectedEndDate: formatISO(twoMonthsLater),
    totalCost: 40000,
    totalRevenue: 60000,
    createdAt: formatISO(twoMonthsAgo),
  },
  {
    id: "proj-009",
    code: "P2023-009",
    name: "Portal de Atendimento ao Cliente",
    customerId: "cust-008",
    customerName: "Telecom Services",
    status: "COMPLETED",
    startDate: formatISO(threeMonthsAgo),
    endDate: formatISO(today),
    expectedEndDate: formatISO(today),
    totalCost: 25000,
    totalRevenue: 38000,
    createdAt: formatISO(threeMonthsAgo),
  },
];