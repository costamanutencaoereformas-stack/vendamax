USE budget_sales;

-- Inserir clientes de exemplo
INSERT INTO customers (id, name, document, document_type, email, phone, address, city, state, zip_code, classification) VALUES
(UUID(), 'João Silva', '123.456.789-00', 'CPF', 'joao@email.com', '(11) 98765-4321', 'Rua A, 123', 'São Paulo', 'SP', '01234-567', 'VIP'),
(UUID(), 'Maria Santos', '987.654.321-00', 'CPF', 'maria@email.com', '(11) 91234-5678', 'Rua B, 456', 'São Paulo', 'SP', '04567-890', 'REGULAR'),
(UUID(), 'Construções ABC Ltda', '12.345.678/0001-90', 'CNPJ', 'contato@construcoes.com', '(11) 3456-7890', 'Av. Principal, 789', 'São Paulo', 'SP', '08765-432', 'VIP');

-- Inserir fornecedores de exemplo
INSERT INTO suppliers (id, name, trade_name, cnpj, email, phone, address, city, state, zip_code, payment_terms) VALUES
(UUID(), 'Fornecedora de Materiais XYZ', 'XYZ Materiais', '23.456.789/0001-12', 'vendas@xyz.com', '(11) 4567-8901', 'Av. Comercial, 1000', 'São Paulo', 'SP', '02345-678', 'Prazo 30 dias'),
(UUID(), 'Distribuidora ABC', 'ABC Dist', '34.567.890/0001-23', 'comercial@abc.com', '(11) 5678-9012', 'Rua do Comércio, 500', 'Guarulhos', 'SP', '07654-321', 'À vista'),
(UUID(), 'Ferramentas e Cia', 'Ferr&Cia', '45.678.901/0001-34', 'vendas@ferrecia.com', '(11) 6789-0123', 'Av. Industrial, 200', 'Osasco', 'SP', '06543-210', 'Prazo 45 dias');

-- Inserir mais categorias específicas
INSERT INTO categories (id, name, description) VALUES
(UUID(), 'Acabamentos', 'Materiais para acabamento'),
(UUID(), 'Pintura', 'Tintas e materiais para pintura'),
(UUID(), 'Jardinagem', 'Produtos para jardim'),
(UUID(), 'Segurança', 'Equipamentos de proteção'),
(UUID(), 'Iluminação', 'Produtos para iluminação');