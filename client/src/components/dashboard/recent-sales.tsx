import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatDateTime, formatDocument } from "@/lib/formatters";
import { User, Building2 } from "lucide-react";
import type { Sale, Customer } from "@shared/schema";

export default function RecentSales() {
  const { data: sales, isLoading } = useQuery({
    queryKey: ["/api/sales"],
  });

  const { data: customers } = useQuery({
    queryKey: ["/api/customers"],
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Vendas Recentes</h3>
        </div>
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const recentSales = sales?.slice(0, 5) || [];
  const customerMap = new Map(customers?.map((c: Customer) => [c.id, c]) || []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Vendas Recentes</h3>
          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            Ver todas
          </button>
        </div>
      </div>
      
      {recentSales.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>Nenhuma venda registrada ainda</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentSales.map((sale: Sale) => {
                const customer = customerMap.get(sale.customerId);
                const isCompany = customer?.documentType === 'CNPJ';
                
                return (
                  <tr key={sale.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          {isCompany ? (
                            <Building2 className="text-gray-500 text-sm" />
                          ) : (
                            <User className="text-gray-500 text-sm" />
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900">
                            {customer?.name || 'Cliente não encontrado'}
                          </p>
                          {customer && (
                            <p className="text-sm text-gray-500">
                              {formatDocument(customer.document)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(sale.total)}
                      </p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        sale.status === 'COMPLETED' 
                          ? 'bg-green-100 text-green-800'
                          : sale.status === 'PROCESSING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {sale.status === 'COMPLETED' ? 'Concluída' : 
                         sale.status === 'PROCESSING' ? 'Processando' : 'Cancelada'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sale.createdAt ? formatDateTime(sale.createdAt) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
