# VendaMax - Sistema de Gestão de Vendas

## Overview

VendaMax is a comprehensive Brazilian sales and inventory management system designed for small to medium-sized businesses. The application provides complete management of customers, products, suppliers, inventory, quotes, and sales with Brazilian-specific features like CPF/CNPJ validation, Brazilian currency formatting, and Portuguese language interface.

The system follows a full-stack architecture with a React frontend, Express backend, and PostgreSQL database using Drizzle ORM. It's built as a single-page application with real-time data management and responsive design using Tailwind CSS and shadcn/ui components.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens and CSS variables
- **Forms**: React Hook Form with Zod validation for type-safe form handling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **API Design**: RESTful API with CRUD operations for all entities
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Schema Validation**: Zod schemas shared between frontend and backend
- **Error Handling**: Centralized error handling middleware
- **Development**: Hot reload with custom Vite integration

### Database Design
- **Database**: PostgreSQL with UUID primary keys
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Core Entities**:
  - Users (authentication and authorization)
  - Customers (CPF/CNPJ support, Brazilian address fields)
  - Suppliers (CNPJ validation, payment terms)
  - Categories (product categorization)
  - Products (pricing, stock management, barcode support)
  - Inventory (stock movements with transaction types)
  - Quotes (with line items and approval workflow)
  - Sales (with payment methods and completion status)

### Authentication & Authorization
- Session-based authentication using PostgreSQL session storage
- Role-based access control with user roles (user, admin)
- Connect-pg-simple for PostgreSQL session management

### Business Logic Features
- **Brazilian Compliance**: CPF/CNPJ validation, Brazilian phone/address formatting
- **CNPJ API Integration**: Automatic company data import via BrasilAPI for new customer registration
- **Inventory Management**: Real-time stock tracking, low stock alerts, movement history
- **Quote to Sale Workflow**: Convert approved quotes directly to sales
- **Multi-payment Support**: Cash, card, PIX, and boleto payment methods
- **Responsive Dashboard**: Real-time metrics, sales charts, and quick actions

### Development Architecture
- **Monorepo Structure**: Shared schemas and types between client/server
- **Type Safety**: End-to-end TypeScript with shared Zod schemas
- **Development Tools**: ESBuild for production builds, TSX for development
- **Code Organization**: Feature-based component structure with shared utilities

## External Dependencies

### Core Framework Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver optimized for serverless environments
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **express**: Web application framework for Node.js
- **react**: Frontend framework for building user interfaces
- **@tanstack/react-query**: Server state management and caching

### UI and Styling
- **@radix-ui/react-***: Comprehensive set of accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library with consistent design
- **class-variance-authority**: Type-safe CSS class composition
- **cmdk**: Command palette component

### Form and Validation
- **react-hook-form**: Performant forms with minimal re-renders
- **@hookform/resolvers**: Integration with validation libraries
- **zod**: TypeScript-first schema validation
- **drizzle-zod**: Generate Zod schemas from Drizzle tables

### Development and Build Tools
- **vite**: Fast build tool and development server
- **typescript**: Static type checking
- **esbuild**: Fast JavaScript bundler for production
- **tsx**: TypeScript execution engine for development

### Database and Session Management
- **connect-pg-simple**: PostgreSQL session store for Express
- **drizzle-kit**: Database migrations and schema management

### Date and Utility Libraries
- **date-fns**: Modern JavaScript date utility library
- **wouter**: Lightweight router for React applications
- **nanoid**: URL-safe unique string ID generator

### Development Enhancement
- **@replit/vite-plugin-runtime-error-modal**: Development error overlay
- **@replit/vite-plugin-cartographer**: Development tooling for Replit environment