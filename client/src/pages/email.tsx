import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Mail } from "lucide-react";

export default function EmailPage() {
  // Placeholder page for future Gmail OAuth integration
  const handleConnect = () => {
    // In a future step, this will start the OAuth flow on the server
    window.open("https://mail.google.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            E-mail
          </CardTitle>
          <CardDescription>
            Conecte sua conta do Gmail para enviar e receber e-mails diretamente pelo sistema.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="py-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Nesta primeira versão, você pode abrir o Gmail em uma nova aba. Em breve, adicionaremos
              a integração segura via OAuth para listar sua caixa de entrada, enviar mensagens e anexar
              orçamentos e vendas como PDFs.
            </p>
            <Button onClick={handleConnect} className="gap-2">
              <Mail className="h-4 w-4" />
              Conectar ao Gmail
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
