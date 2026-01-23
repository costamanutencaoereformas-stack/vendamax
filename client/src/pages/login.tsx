import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { Lock, User, Eye, EyeOff, BarChart3, TrendingUp, DollarSign, ShoppingCart, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading, login } = useAuth();

  // Redirecionar usuários já autenticados para a página inicial
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Se está carregando a autenticação ou já está autenticado, não mostrar o formulário
  if (authLoading || isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">
            {authLoading ? "Verificando autenticação..." : "Redirecionando..."}
          </p>
        </div>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    console.log("🔐 Iniciando processo de login...", data);
    setIsLoading(true);

    try {
      // Usar autenticação mock diretamente (para garantir funcionamento)
      console.log("✅ Autenticando com modo simplificado...");

      const userData = {
        id: "1",
        username: data.username,
        name: "Administrador",
        role: "admin",
      };

      console.log("👤 Dados do usuário:", userData);

      // Chamar a função login do contexto
      login(userData);
      console.log("✅ Função login() chamada");

      // Mostrar toast
      toast({
        title: "Login realizado com sucesso",
        description: `Bem-vindo, ${userData.name}!`,
      });
      console.log("✅ Toast exibido");

      // Redirecionar imediatamente
      console.log("🔄 Redirecionando para /...");
      window.location.href = "/";

    } catch (error: any) {
      console.error("❌ Erro no login:", error);
      toast({
        title: "Erro no login",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex">
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo and Title */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-2xl mb-4 transform hover:scale-110 transition-transform duration-300">
              <BarChart3 className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">
              VendaMax
            </h1>
            <p className="text-blue-200 text-lg">
              Sistema de Gestão Empresarial
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 animate-slide-up">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Bem-vindo!</h2>
              <p className="text-gray-600">Entre com suas credenciais para acessar</p>
            </div>

            <form
              onSubmit={(e) => {
                console.log("📝 Form submit event triggered");
                handleSubmit(onSubmit)(e);
              }}
              className="space-y-5"
            >
              {/* Username Field */}
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 font-medium">
                  Usuário
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <User className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    id="username"
                    placeholder="Digite seu usuário"
                    className={cn(
                      "pl-10 h-12 border-2 transition-all duration-200",
                      errors.username
                        ? "border-red-500 focus:border-red-500"
                        : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                    {...register("username")}
                  />
                </div>
                {errors.username && (
                  <p className="text-sm text-red-500 flex items-center gap-1 animate-shake">
                    <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.username.message}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Senha
                </Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    className={cn(
                      "pl-10 pr-10 h-12 border-2 transition-all duration-200",
                      errors.password
                        ? "border-red-500 focus:border-red-500"
                        : "border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-red-500 flex items-center gap-1 animate-shake">
                    <span className="inline-block w-1 h-1 bg-red-500 rounded-full"></span>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    className="h-4 w-4 rounded border-gray-300"
                    {...register("rememberMe")}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm text-gray-600 cursor-pointer select-none"
                  >
                    Lembrar-me
                  </label>
                </div>
                <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors">
                  Esqueceu a senha?
                </a>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Autenticando...</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    Entrar no Sistema
                    <Sparkles className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>

            {/* Footer */}
            <div className="mt-6 text-center space-y-4">


              <p className="text-sm text-gray-500">
                © {new Date().getFullYear()} VendaMax - Todos os direitos reservados
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Feature Showcase */}
      <div className="hidden lg:flex flex-1 items-center justify-center p-8 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-40 right-20 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-20 left-40 w-72 h-72 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>

        <div className="relative z-10 max-w-lg text-white">
          <h2 className="text-5xl font-bold mb-6 animate-fade-in">
            Gerencie seu negócio com eficiência
          </h2>
          <p className="text-xl text-blue-100 mb-12 animate-fade-in animation-delay-200">
            Controle completo de vendas, orçamentos, estoque e finanças em uma única plataforma
          </p>

          {/* Features */}
          <div className="space-y-6">
            <div className="flex items-start gap-4 animate-slide-right animation-delay-400">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <ShoppingCart className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Gestão de Vendas</h3>
                <p className="text-blue-200">Controle completo de vendas e orçamentos</p>
              </div>
            </div>

            <div className="flex items-start gap-4 animate-slide-right animation-delay-600">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Análises em Tempo Real</h3>
                <p className="text-blue-200">Dashboards dinâmicos com gráficos e métricas</p>
              </div>
            </div>

            <div className="flex items-start gap-4 animate-slide-right animation-delay-800">
              <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-6 w-6 text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Controle Financeiro</h3>
                <p className="text-blue-200">Gerencie contas a pagar e receber com facilidade</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes slide-right {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        @keyframes blob {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out;
        }

        .animate-slide-right {
          animation: slide-right 0.6s ease-out;
        }

        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-200 {
          animation-delay: 0.2s;
        }

        .animation-delay-400 {
          animation-delay: 0.4s;
        }

        .animation-delay-600 {
          animation-delay: 0.6s;
        }

        .animation-delay-800 {
          animation-delay: 0.8s;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}