import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import { toast } from "sonner";
import { Loader2, FileText, FilePlus2, Wallet, FileDown, History, ChevronDown, ChevronUp, Landmark, Search, ArrowUpDown, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "../hooks/useRealtime";
import { downloadInvoicePdf } from "../lib/invoicePdf";

interface Payment {
  id: string;
  amount: number;
  payment_method: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  technician_id: string;
  subtotal: number;
  tax_amount: number;
  tax_rate: number;
  total: number;
  amount_paid: number;
  remaining_amount: number;
  created_at: string;
  customers?: { name: string } | null;
  payments?: Payment[];
}

const STATUS_LABEL: Record<string, string> = {
  paid: "مكتملة", partial: "تقسيط / جزئي", unpaid: "غير مدفوعة",
};
const STATUS_VAR: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default", partial: "secondary", unpaid: "destructive",
};

const Invoices = () => {
  const { isTechnician, isAdmin, isStorekeeper, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Invoice>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("invoices")
      .select("*, customers(name), payments(*)")
      .order("created_at", { ascending: false }) as any);
    setInvoices((data as any[] ?? []) as Invoice[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  useRealtime("invoices-rt", ["invoices", "payments"], () => load());

  const openPay = (inv: Invoice) => {
    setPayInvoice(inv); setPayAmount(String(inv.remaining_amount)); setPayMethod("cash");
    setPayOpen(true);
  };

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInvoice) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error("أدخل مبلغًا صحيحًا"); return; }
    setSaving(true);
    const { error } = await supabase.rpc("record_payment", {
      _invoice_id: payInvoice.id, _amount: amt, _method: payMethod,
    });
    setSaving(false);
    if (error) { toast.error("فشل تسجيل الدفعة: " + error.message); return; }
    toast.success("تم تسجيل الدفعة بنجاح");
    setPayOpen(false); load();
  };

  const filteredInvoices = invoices
    .filter(inv => 
      inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (inv.customers?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const toggleSort = (field: keyof Invoice) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const canCreate = isTechnician || isSuperAdmin;
  const canRecordPayment = isAdmin || isStorekeeper || isSuperAdmin;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4 px-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3">
              <FileText className="h-8 w-8 sm:h-9 sm:w-9 text-primary" /> الفواتير والتحصيل
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-lg">متابعة الفواتير، الأقساط، وحالة الدفع</p>
          </div>
          {canCreate && (
            <Button onClick={() => navigate("/invoices/new")} className="shadow-lg h-10 sm:h-12 px-4 sm:px-6 text-sm sm:text-lg">
              <FilePlus2 className="h-5 w-5 ml-2" /> فاتورة جديدة
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl shadow-sm border mx-2">
          <div className="relative w-full sm:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث برقم الفاتورة أو اسم العميل..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 text-right h-11"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex gap-2 text-xs text-muted-foreground items-center">
              <span>ترتيب حسب: </span>
              <button onClick={() => toggleSort("created_at")} className={`hover:text-primary ${sortField === "created_at" ? "text-primary font-bold" : ""}`}>التاريخ</button>
              <span>|</span>
              <button onClick={() => toggleSort("total")} className={`hover:text-primary ${sortField === "total" ? "text-primary font-bold" : ""}`}>المبلغ</button>
              <span>|</span>
              <button onClick={() => toggleSort("remaining_amount")} className={`hover:text-primary ${sortField === "remaining_amount" ? "text-primary font-bold" : ""}`}>المتبقي</button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 px-2">
          {loading ? (
            <Card className="p-20 flex justify-center border-none shadow-xl"><Loader2 className="h-10 w-10 animate-spin text-primary" /></Card>
          ) : filteredInvoices.length === 0 ? (
            <Card className="p-20 text-center text-muted-foreground border-none shadow-xl text-xl">لا توجد فواتير تطابق البحث</Card>
          ) : (
            filteredInvoices.map((inv) => {
              const status = inv.remaining_amount === 0 ? "paid" : inv.remaining_amount === inv.total ? "unpaid" : "partial";
              return (
                <Card key={inv.id} className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-shadow">
                  <div className="p-4 sm:p-6">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="space-y-1 text-right flex-grow">
                        <div className="flex items-center gap-3 justify-start sm:justify-end flex-row-reverse">
                          <span className="font-mono text-lg sm:text-xl font-bold bg-muted px-3 py-1 rounded">#{inv.invoice_number}</span>
                          <Badge variant={STATUS_VAR[status]} className="text-xs sm:text-sm font-bold px-3">
                            {STATUS_LABEL[status]}
                          </Badge>
                        </div>
                        <p className="text-lg sm:text-xl font-black">{inv.customers?.name}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("ar-EG")}</p>
                      </div>

                      <div className="flex flex-wrap gap-4 sm:gap-8 items-center bg-muted/30 p-3 sm:p-4 rounded-xl w-full sm:w-auto justify-center">
                        <div className="text-center">
                          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">الإجمالي</p>
                          <p className="text-sm sm:text-lg font-bold">{Number(inv.total).toLocaleString()} ج.م</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">المدفوع</p>
                          <p className="text-sm sm:text-lg font-bold text-green-600">{Number(inv.amount_paid).toLocaleString()} ج.م</p>
                        </div>
                        <div className="text-center sm:border-r sm:pr-8 sm:mr-4">
                          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">المتبقي</p>
                          <p className="text-lg sm:text-2xl font-black text-red-600">{Number(inv.remaining_amount).toLocaleString()} ج.م</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Button variant="ghost" size="icon" onClick={() => downloadInvoicePdf(inv.id)} title="تنزيل PDF">
                          <FileDown className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate(`/invoices/${inv.id}`)} title="عرض التفاصيل">
                          <Eye className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                        {canRecordPayment && status !== "paid" && (
                          <Button variant="default" size="sm" className="gap-2 text-xs sm:text-sm" onClick={() => navigate(`/invoices/${inv.id}`)}>
                            <Wallet className="h-4 w-4" /> تحصيل
                          </Button>
                        )}
                        <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}>
                          {expandedId === inv.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          <span className="hidden sm:inline mr-1">السجل</span>
                        </Button>
                      </div>
                    </div>

                    {expandedId === inv.id && (
                      <div className="mt-6 pt-6 border-t animate-in fade-in slide-in-from-top-2">
                        <h4 className="font-bold flex items-center gap-2 mb-4">
                          <History className="h-4 w-4 text-primary" /> تاريخ عمليات الدفع
                        </h4>
                        <div className="overflow-x-auto rounded-lg border bg-muted/20">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">التاريخ</TableHead>
                                <TableHead className="text-center">المبلغ</TableHead>
                                <TableHead className="text-center">الطريقة</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {inv.payments && inv.payments.length > 0 ? (
                                inv.payments.map((p) => (
                                  <TableRow key={p.id}>
                                    <TableCell className="text-right text-xs sm:text-sm">{new Date(p.created_at).toLocaleString("ar-EG")}</TableCell>
                                    <TableCell className="text-center font-bold text-xs sm:text-sm">{Number(p.amount).toLocaleString()} ج.م</TableCell>
                                    <TableCell className="text-center"><Badge variant="outline" className="text-[10px] sm:text-xs">{p.payment_method}</Badge></TableCell>
                                  </TableRow>
                                ))
                              ) : (
                                <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">لا يوجد سجل دفعات</TableCell></TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent dir="rtl" className="text-right max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
               <Landmark className="h-6 w-6 text-primary" /> تسجيل تحصيل مالي
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPay} className="space-y-5 pt-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <p className="text-xs sm:text-sm text-red-600 mb-1 font-bold">المتبقي المطلوب تحصيله:</p>
              <p className="text-2xl sm:text-3xl font-black text-red-700">{payInvoice?.remaining_amount.toLocaleString()} ج.م</p>
            </div>
            <div className="space-y-2">
              <Label className="text-base sm:text-lg font-bold">مبلغ الدفعة المستلمة *</Label>
              <Input type="number" min={0.01} max={payInvoice?.remaining_amount} step="0.01"
                value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                dir="ltr" className="text-right text-xl sm:text-2xl h-12 sm:h-14 font-mono" required />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">وسيلة الدفع / مرجع العملية</Label>
              <Input value={payMethod} onChange={(e) => setPayMethod(e.target.value)} placeholder="نقدي، تحويل، فودافون كاش..." className="h-10 sm:h-12" />
            </div>
            <DialogFooter className="gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} className="h-10 sm:h-12 flex-1">إلغاء</Button>
              <Button type="submit" disabled={saving} className="h-10 sm:h-12 flex-1 text-base sm:text-lg">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "تأكيد التحصيل"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Invoices;

