import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search, Upload as UploadIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Category { id: string; name: string; description?: string | null }
interface Segment { id: string; name: string; color?: string | null }
interface AppUser { id: string; username: string; name: string; role: "admin" | "user" }
interface CompanySettings {
  id?: string;
  name: string;
  tradeName?: string | null;
  cnpj: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  number?: string | null;
  complement?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  paymentTerms?: string | null;
  logoUrl?: string | null;
}

export default function CompanySettings() {
  const { toast } = useToast();

  async function parseJSONSafe(res: Response) {
    if (res.status === 204) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return res.json();
    }
    return null;
  }

  async function buildError(res: Response, fallback: string) {
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        throw new Error(data?.message || fallback);
      } else {
        const text = await res.text();
        throw new Error(text || fallback);
      }
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(fallback);
    }
  }

  // Company info
  const [company, setCompany] = useState<CompanySettings>({
    name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    logoUrl: "",
  });

  // Helpers
  const cleanCNPJ = (cnpj: string) => (cnpj || "").replace(/\D/g, "");
  const hasValidCNPJ = useMemo(() => cleanCNPJ(company.cnpj).length === 14, [company.cnpj]);

  // Load existing company
  const companyQuery = useQuery<CompanySettings | null>({
    queryKey: ["company"],
    queryFn: async () => {
      const res = await fetch("/api/company");
      if (res.status === 404) return null;
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Erro ao carregar dados da empresa");
      }
      return res.json();
    },
  });

  useEffect(() => {
    if (companyQuery.data) {
      setCompany((prev) => ({ ...prev, ...companyQuery.data }));
    }
  }, [companyQuery.data]);

  // Save company
  const saveCompany = useMutation({
    mutationFn: async (payload: CompanySettings) => {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, cnpj: cleanCNPJ(payload.cnpj) }),
      });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const d = await res.json();
          throw new Error(d?.message || "Erro ao salvar empresa");
        }
        throw new Error((await res.text()) || "Erro ao salvar empresa");
      }
      return res.json() as Promise<CompanySettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["company"], data);
      setCompany((prev) => ({ ...prev, ...data }));
      toast({ title: "Empresa salva com sucesso" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // CNPJ lookup
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const handleLookupCNPJ = async () => {
    const cnpj = cleanCNPJ(company.cnpj);
    if (cnpj.length !== 14) return;
    try {
      setCnpjLoading(true);
      const res = await fetch(`/api/cnpj/${cnpj}`);
      if (!res.ok) throw new Error("Falha ao consultar CNPJ");
      const data = await res.json();
      // Mapear campos comuns de ReceitaWS
      const mapped: Partial<CompanySettings> = {
        name: data.nome || data.razao_social || company.name,
        tradeName: data.fantasia || null,
        email: data.email || null,
        phone: data.telefone || null,
        address: data.logradouro || null,
        number: data.numero || null,
        district: data.bairro || null,
        city: data.municipio || data.localidade || null,
        state: data.uf || null,
        zipCode: (data.cep && String(data.cep)) || null,
      };
      setCompany((prev) => ({ ...prev, ...mapped }));
      toast({ title: "Dados preenchidos pelo CNPJ" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setCnpjLoading(false);
    }
  };

  // Logo upload
  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/company/logo", { method: "POST", body: fd });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("application/json")) {
          const d = await res.json();
          throw new Error(d?.message || "Erro ao enviar logo");
        }
        throw new Error((await res.text()) || "Erro ao enviar logo");
      }
      const { logoUrl } = await res.json();
      return logoUrl as string;
    },
    onSuccess: (logoUrl) => {
      setCompany((prev) => ({ ...prev, logoUrl }));
      // Se já existe empresa no backend, o endpoint já atualiza; caso contrário, o próximo salvar irá persistir
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast({ title: "Logo enviada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Erro ao carregar categorias");
      return res.json();
    },
  });

  const createCategory = useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await buildError(res, "Erro ao criar categoria");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoria criada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; description?: string }) => {
      const res = await fetch(`/api/categories/${id}` , {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await buildError(res, "Erro ao atualizar categoria");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoria atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) await buildError(res, "Erro ao excluir categoria");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Categoria excluída" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Segments
  const { data: segments = [] } = useQuery<Segment[]>({
    queryKey: ["segments"],
    queryFn: async () => {
      const res = await fetch("/api/segments");
      if (!res.ok) throw new Error("Erro ao carregar segmentos");
      return res.json();
    },
  });

  const createSegment = useMutation({
    mutationFn: async (payload: { name: string; color?: string }) => {
      const res = await fetch("/api/segments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await buildError(res, "Erro ao criar segmento");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast({ title: "Segmento criado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateSegment = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name: string; color?: string }) => {
      const res = await fetch(`/api/segments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await buildError(res, "Erro ao atualizar segmento");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast({ title: "Segmento atualizado" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteSegment = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/segments/${id}`, { method: "DELETE" });
      if (!res.ok) await buildError(res, "Erro ao excluir segmento");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast({ title: "Segmento excluído" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Users
  const { data: users = [], isLoading: usersLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) await buildError(res, "Erro ao carregar usuários");
      return (await parseJSONSafe(res)) || [];
    },
  });

  const createUser = useMutation({
    mutationFn: async (payload: { username: string; password: string; name: string; role: "admin" | "user" }) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) await buildError(res, "Erro ao criar usuário");
      return parseJSONSafe(res);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Usuário criado" });
      setNewUser({ username: "", name: "", password: "", role: "user" });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Local state for inline add/edit
  const [newCategory, setNewCategory] = useState({ name: "", description: "" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newSegment, setNewSegment] = useState({ name: "", color: "#2563eb" });
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
  const [newUser, setNewUser] = useState({ username: "", name: "", password: "", role: "user" as "admin" | "user" });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="company">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="company">Dados da Empresa</TabsTrigger>
          <TabsTrigger value="users">Cadastro de Usuário</TabsTrigger>
          <TabsTrigger value="categories">Categorias de Produtos</TabsTrigger>
          <TabsTrigger value="segments">Segmentos de Empresas</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Empresa</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input placeholder="Razão Social" value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} />
              <div className="flex gap-2">
                <Input placeholder="CNPJ" value={company.cnpj} onChange={(e) => setCompany({ ...company, cnpj: e.target.value })} />
                <Button type="button" variant="outline" onClick={handleLookupCNPJ} disabled={!hasValidCNPJ || cnpjLoading} title="Buscar por CNPJ">
                  {cnpjLoading ? '...' : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <Input placeholder="E-mail" value={company.email || ''} onChange={(e) => setCompany({ ...company, email: e.target.value })} />
              <Input placeholder="Telefone" value={company.phone || ''} onChange={(e) => setCompany({ ...company, phone: e.target.value })} />
              <Input placeholder="Endereço" value={company.address || ''} onChange={(e) => setCompany({ ...company, address: e.target.value })} className="md:col-span-2" />
              <Input placeholder="Número" value={company.number || ''} onChange={(e) => setCompany({ ...company, number: e.target.value })} />
              <Input placeholder="Complemento" value={company.complement || ''} onChange={(e) => setCompany({ ...company, complement: e.target.value })} />
              <Input placeholder="Bairro" value={company.district || ''} onChange={(e) => setCompany({ ...company, district: e.target.value })} />
              <Input placeholder="Cidade" value={company.city || ''} onChange={(e) => setCompany({ ...company, city: e.target.value })} />
              <Input placeholder="Estado" value={company.state || ''} onChange={(e) => setCompany({ ...company, state: e.target.value })} />
              <Input placeholder="CEP" value={company.zipCode || ''} onChange={(e) => setCompany({ ...company, zipCode: e.target.value })} />
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 items-start gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20 border rounded flex items-center justify-center overflow-hidden bg-muted">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt="Logo" className="object-contain w-full h-full" />
                    ) : (
                      <span className="text-xs text-muted-foreground">Sem logo</span>
                    )}
                  </div>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadLogo.mutate(f);
                      }}
                    />
                    <span className="px-3 py-2 border rounded inline-flex items-center gap-2 text-sm">
                      <UploadIcon className="h-4 w-4" /> Enviar Logo
                    </span>
                  </label>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="button" onClick={() => saveCompany.mutate(company)} disabled={saveCompany.isPending || !company.name || !hasValidCNPJ}>
                    {saveCompany.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Novo Usuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3">
                  <Input placeholder="Nome completo" value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
                  <Input placeholder="Usuário" value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
                  <Input placeholder="Senha" type="password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-muted-foreground">Função</label>
                    <select className="border rounded px-2 py-1" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "admin" | "user" })}>
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => createUser.mutate(newUser)} disabled={createUser.isPending || !newUser.username || !newUser.password || !newUser.name}>Cadastrar</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usuários Cadastrados</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Função</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow><TableCell colSpan={3}>Carregando...</TableCell></TableRow>
                    ) : users.length === 0 ? (
                      <TableRow><TableCell colSpan={3}>Nenhum usuário encontrado</TableCell></TableRow>
                    ) : (
                      users.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.username}</TableCell>
                          <TableCell className="capitalize">{u.role}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Categorias de Produtos</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
                  </DialogTrigger>
                  <DialogContent className="w-screen h-[90vh] sm:h-auto sm:max-w-[520px] max-w-none p-4 overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nova Categoria</DialogTitle>
                      <DialogDescription>Preencha os dados para criar uma nova categoria.</DialogDescription>
                    </DialogHeader>
                    <CardContent className="space-y-3">
                      <Input placeholder="Nome" value={newCategory.name} onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })} />
                      <Input placeholder="Descrição" value={newCategory.description} onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })} />
                      <div className="flex justify-end">
                        <Button onClick={() => { createCategory.mutate({ name: newCategory.name, description: newCategory.description || undefined }); setNewCategory({ name: "", description: "" }); }}>Salvar</Button>
                      </div>
                    </CardContent>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell>
                              {editingCategory?.id === c.id ? (
                                <Input value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} />
                              ) : c.name}
                            </TableCell>
                            <TableCell>
                              {editingCategory?.id === c.id ? (
                                <Input value={editingCategory.description || ""} onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })} />
                              ) : (c.description || "-")}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              {editingCategory?.id === c.id ? (
                                <Button size="sm" onClick={() => { updateCategory.mutate({ id: c.id, name: editingCategory.name, description: editingCategory.description || undefined }); setEditingCategory(null); }}>Salvar</Button>
                              ) : (
                                <Button variant="outline" size="sm" onClick={() => setEditingCategory(c)}><Edit className="h-4 w-4" /></Button>
                              )}
                              <Button variant="destructive" size="sm" onClick={() => deleteCategory.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segments">
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Segmentos de Empresas</CardTitle>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="h-4 w-4 mr-2" />Novo Segmento</Button>
                  </DialogTrigger>
                  <DialogContent className="w-screen h-[90vh] sm:h-auto sm:max-w-[520px] max-w-none p-4 overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Novo Segmento</DialogTitle>
                      <DialogDescription>Preencha os dados para criar um novo segmento.</DialogDescription>
                    </DialogHeader>
                    <CardContent className="space-y-3">
                      <Input placeholder="Nome" value={newSegment.name} onChange={(e) => setNewSegment({ ...newSegment, name: e.target.value })} />
                      <Input type="color" value={newSegment.color} onChange={(e) => setNewSegment({ ...newSegment, color: e.target.value })} />
                      <div className="flex justify-end">
                        <Button onClick={() => { createSegment.mutate({ name: newSegment.name, color: newSegment.color }); setNewSegment({ name: "", color: "#2563eb" }); }}>Salvar</Button>
                      </div>
                    </CardContent>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                <div className="min-w-[720px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Cor</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {segments.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          {editingSegment?.id === s.id ? (
                            <Input value={editingSegment.name} onChange={(e) => setEditingSegment({ ...editingSegment, name: e.target.value })} />
                          ) : s.name}
                        </TableCell>
                        <TableCell>
                          {editingSegment?.id === s.id ? (
                            <Input type="color" value={editingSegment.color || "#2563eb"} onChange={(e) => setEditingSegment({ ...editingSegment, color: e.target.value })} />
                          ) : (
                            <div className="w-5 h-5 rounded-full" style={{ backgroundColor: s.color || "#2563eb" }} />
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {editingSegment?.id === s.id ? (
                            <Button size="sm" onClick={() => { updateSegment.mutate({ id: s.id, name: editingSegment.name, color: editingSegment.color ?? undefined }); setEditingSegment(null); }}>Salvar</Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setEditingSegment(s)}><Edit className="h-4 w-4" /></Button>
                          )}
                          <Button variant="destructive" size="sm" onClick={() => deleteSegment.mutate(s.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
