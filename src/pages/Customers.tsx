import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { 
  Plus, Loader2, Pencil, Trash2, Search, ArrowUpDown, Eye, ExternalLink, 
  UserCircle2, Phone, Mail, MapPin, History, Receipt 
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { ActivityLogTab } from "../components/ActivityLogTab";

interface Customer {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  type: string;
  notes: string | null;
  total_debt?: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  amount_paid: number;
  remaining_amount: number;
  created_at: string;
  payment_status: string;
}

const TYPE_LABELS: Record<string, string> = {
  company: "شركة",
  individual: "فرد",
  government: "جهة حكومية",
};

const Customers = () => {
  const { isAdmin, isStorekeeper, isSuperAdmin } = useAuth();
  const canEdit = isAdmin || isStorekeeper;
  const canDelete = isSuperAdmin || isAdmin;

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [type, setType] = useState<string>("company");
  const [notes, setNotes] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Customer>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase.from("customers").select(`
      *,
      invoices(remaining_amount)
    `).order("name") as any);
    
    const mapped = (data as any[] ?? []).map((c: any) => ({
      ...c,
      total_debt: c.invoices?.reduce((sum: number, inv: any) => sum + Number(inv.remaining_amount), 0) || 0
    }));
    
    setCustomers(mapped as Customer[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setEditing(null); setName(""); setContactPerson(""); setPhone("");
    setEmail(""); setAddress(""); setType("company"); setNotes("");
  };

  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name); setContactPerson(c.contact_person ?? "");
    setPhone(c.phone ?? ""); setEmail(c.email ?? "");
    setAddress(c.address ?? ""); setType(c.type); setNotes(c.notes ?? "");
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      type,
      notes: notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert(payload);
    setSaving(false);
    if (error) { toast.error("فشل الحفظ", { description: error.message }); return; }
    toast.success(editing ? "تم تحديث العميل" : "تم إضافة العميل");
    setOpen(false); reset(); load();
  };

  const remove = async (c: Customer) => {
    if (!confirm(`حذف العميل "${c.name}"؟`)) return;
    const { error } = await supabase.from("customers").delete().eq("id", c.id);
    if (error) { toast.error("فشل الحذف", { description: error.message }); return; }
    toast.success("تم الحذف");
    load();
  };

  const viewDetails = async (c: Customer) => {
    setSelectedCustomer(c);
    setOpenDetails(true);
    setLoadingInvoices(true);
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", c.id)
      .order("created_at", { ascending: false });
    setCustomerInvoices((data ?? []) as Invoice[]);
    setLoadingInvoices(false);
  };

  const filteredCustomers = customers
    .filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.phone || "").includes(searchQuery)
    )
    .sort((a, b) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const toggleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6 px-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-extrabold flex items-center gap-2">
              <UserCircle2 className="h-8 w-8 text-primary" />
              العملاء
            </h1>
            <p className="text-muted-foreground mt-1">إدارة قاعدة بيانات العملاء ومتابعة المديونيات</p>
          </div>
          {canEdit && (
            <Button onClick={openNew} className="h-11 shadow-md"><Plus className="h-4 w-4 ml-2" />عميل جديد</Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl shadow-sm border">
          <div className="relative w-full sm:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث باسم العميل أو رقم الهاتف..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 text-right h-11"
            />
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>ترتيب حسب: </span>
            <button onClick={() => toggleSort("name")} className={`hover:text-primary ${sortField === "name" ? "text-primary font-bold" : ""}`}>الاسم</button>
            <span>|</span>
            <button onClick={() => toggleSort("total_debt" as any)} className={`hover:text-primary ${sortField === "total_debt" as any ? "text-primary font-bold" : ""}`}>المديونية</button>
          </div>
        </div>

        <Card className="overflow-hidden border-none shadow-xl">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">لا يوجد عملاء يطابقون البحث</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right font-bold cursor-pointer" onClick={() => toggleSort("name")}>
                      الاسم <ArrowUpDown className="inline h-3 w-3 mr-1" />
                    </TableHead>
                    <TableHead className="text-right font-bold">النوع</TableHead>
                    <TableHead className="text-center font-bold">إجمالي المديونية</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold text-lg">{c.name}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABELS[c.type] ?? c.type}</Badge></TableCell>
                      <TableCell className="text-center font-black">
                        <span className={c.total_debt && c.total_debt > 0 ? "text-red-600 bg-red-50 px-2 py-1 rounded" : "text-green-600"}>
                          {(c.total_debt || 0).toLocaleString()} ج.م
                        </span>
                      </TableCell>
                      <TableCell dir="ltr" className="text-right font-mono">{c.phone ?? "—"}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => viewDetails(c)}>
                            <Eye className="h-3 w-3" /> تفاصيل
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(c)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent dir="rtl" className="text-right max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{editing ? "تعديل بيانات العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 pt-4">
            <div className="space-y-2"><Label>اسم العميل *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required className="h-11" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">شركة</SelectItem>
                    <SelectItem value="individual">فرد</SelectItem>
                    <SelectItem value="government">جهة حكومية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>جهة الاتصال</Label><Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className="h-11" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-right h-11" /></div>
              <div className="space-y-2"><Label>البريد</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className="text-right h-11" type="email" /></div>
            </div>
            <div className="space-y-2"><Label>العنوان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-11" /></div>
            <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 h-11">إلغاء</Button>
              <Button type="submit" disabled={saving} className="flex-1 h-11">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ العميل"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent dir="rtl" className="text-right max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b pb-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <UserCircle2 className="h-10 w-10 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black">{selectedCustomer?.name}</DialogTitle>
                <div className="flex gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {selectedCustomer?.phone || "—"}</span>
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedCustomer?.email || "—"}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedCustomer?.address || "—"}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <Card className="p-4 bg-muted/30 border-none">
                  <p className="text-xs font-bold text-muted-foreground mb-1">المديونية الكلية</p>
                  <p className="text-2xl font-black text-red-600">{(selectedCustomer?.total_debt || 0).toLocaleString()} ج.م</p>
               </Card>
               <Card className="p-4 bg-muted/30 border-none text-center">
                  <p className="text-xs font-bold text-muted-foreground mb-1">عدد الفواتير</p>
                  <p className="text-2xl font-black">{customerInvoices.length}</p>
               </Card>
               <Card className="p-4 bg-muted/30 border-none text-left">
                  <p className="text-xs font-bold text-muted-foreground mb-1 text-right">أول تعامل</p>
                  <p className="text-xl font-bold text-right">
                    {customerInvoices.length > 0 ? new Date(customerInvoices[customerInvoices.length - 1].created_at).toLocaleDateString('ar-EG') : "—"}
                  </p>
               </Card>
            </div>

            <Tabs defaultValue="ledger" className="w-full">
              <TabsList className="bg-muted/50 p-1 mb-4">
                <TabsTrigger value="ledger" className="gap-2 flex-1"><Receipt className="h-4 w-4" /> سجل الفواتير والمدفوعات</TabsTrigger>
                {isAdmin && <TabsTrigger value="logs" className="gap-2 flex-1"><History className="h-4 w-4" /> سجل الحركات</TabsTrigger>}
              </TabsList>

              <TabsContent value="ledger" className="space-y-4">
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-right">رقم الفاتورة</TableHead>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                        <TableHead className="text-center">المدفوع</TableHead>
                        <TableHead className="text-center">المتبقي</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-center">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingInvoices ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                      ) : customerInvoices.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">لا يوجد فواتير مسجلة</TableCell></TableRow>
                      ) : (
                        customerInvoices.map((inv) => (
                          <TableRow key={inv.id}>
                            <TableCell className="font-bold">{inv.invoice_number}</TableCell>
                            <TableCell className="whitespace-nowrap">{new Date(inv.created_at).toLocaleDateString('ar-EG')}</TableCell>
                            <TableCell className="text-center font-mono">{Number(inv.total).toLocaleString()} ج.م</TableCell>
                            <TableCell className="text-center font-mono text-green-600">{Number(inv.amount_paid).toLocaleString()} ج.م</TableCell>
                            <TableCell className={`text-center font-mono font-bold ${inv.remaining_amount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {Number(inv.remaining_amount).toLocaleString()} ج.م
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={inv.payment_status === 'paid' ? 'default' : inv.payment_status === 'partial' ? 'secondary' : 'destructive'}>
                                {inv.payment_status === 'paid' ? 'تم الدفع' : inv.payment_status === 'partial' ? 'دفع جزئي' : 'غير مدفوع'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button size="icon" variant="ghost" asChild title="فتح الفاتورة">
                                <a href={`/invoices/${inv.id}`} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {isAdmin && (
                <TabsContent value="logs">
                   <ActivityLogTab tableName="customers" recordId={selectedCustomer?.id} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Customers;
