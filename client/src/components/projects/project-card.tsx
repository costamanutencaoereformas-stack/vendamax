import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { CalendarIcon, ClockIcon, DollarSignIcon, BarChartIcon } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: string;
    code: string;
    name: string;
    customerId: string | null;
    customerName?: string | null;
    status: "PLANNING" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
    startDate: string | null;
    endDate: string | null;
    expectedEndDate: string | null;
    totalCost: number | null;
    totalRevenue: number | null;
    createdAt: string;
  };
  onClick?: () => void;
}

const statusColors = {
  PLANNING: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-green-100 text-green-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-purple-100 text-purple-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const statusLabels = {
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em Andamento",
  ON_HOLD: "Em Espera",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  const profit = project.totalRevenue && project.totalCost 
    ? project.totalRevenue - project.totalCost 
    : null;
  
  const profitMargin = project.totalRevenue && profit 
    ? (profit / project.totalRevenue) * 100 
    : null;

  return (
    <Card 
      className="overflow-hidden transition-all hover:shadow-md cursor-pointer" 
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl">{project.name}</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              Código: {project.code}
            </CardDescription>
          </div>
          <Badge 
            className={statusColors[project.status]}
          >
            {statusLabels[project.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        {project.customerName && (
          <div className="text-sm mb-3">
            <span className="font-medium">Cliente:</span> {project.customerName}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-1">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span>Início: {project.startDate ? formatDate(project.startDate) : "Não iniciado"}</span>
          </div>
          <div className="flex items-center gap-1">
            <ClockIcon className="h-4 w-4 text-muted-foreground" />
            <span>Previsão: {project.expectedEndDate ? formatDate(project.expectedEndDate) : "Não definida"}</span>
          </div>
          {project.totalRevenue !== null && (
            <div className="flex items-center gap-1">
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
              <span>Receita: {formatCurrency(project.totalRevenue)}</span>
            </div>
          )}
          {profitMargin !== null && (
            <div className="flex items-center gap-1">
              <BarChartIcon className="h-4 w-4 text-muted-foreground" />
              <span>Margem: {profitMargin.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}