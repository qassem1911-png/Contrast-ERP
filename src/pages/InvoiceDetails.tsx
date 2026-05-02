import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { 
  Loader2, ArrowRight, Printer, Wallet, History, 
  FileText, User, Receipt, CreditCard, Wrench 
} from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "../components/ui/table";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { downloadInvoicePdf } from "../lib/invoicePdf";

const InvoiceDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        *, 
        customers(name), 
        profiles!invoices_technician_id_fkey(arabic_name),
        invoice_items(*, products(name), printers(serial_number))
      `)
      .eq("id", id)
      .single();
    
    if (error) {
      toast.error("الفاتورة غير موجودة");
      navigate("/invoices");
    } else {
      setInvoice(data);
      setPayAmount(String(data.remaining_amount));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const submitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { toast.error("أدخل مبلغًا صحيحًا"); return; }
    setSaving(true);
    // Using the record_payment RPC as requested
    const { error: payError } = await supabase.rpc("record_payment", {
      _invoice_id: invoice.id,
      _amount: amt,
      _method: payMethod
    });

    if (payError) {
      toast.error("فشل تسجيل الدفعة: " + payError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    toast.success("تم تسجيل الدفعة بنجاح");
    setPayOpen(false); 
    load();
  };

  if (loading) return <DashboardLayout><div className="p-20 flex justify-center"><Loader2 className="h-10 w-10 animate-spin" /></div></DashboardLayout>;

  const paymentStatus = invoice.remaining_amount === 0 ? "paid" : invoice.remaining_amount === invoice.total ? "unpaid" : "partial";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 px-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/invoices")} className="gap-2">
            <ArrowRight className="h-4 w-4" /> العودة للفواتير
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadInvoicePdf(invoice.id)} className="gap-2">
              <Printer className="h-4 w-4" /> طباعة PDF
            </Button>
            {paymentStatus !== "paid" && (
              <Button onClick={() => setPayOpen(true)} className="gap-2 bg-green-600 hover:bg-green-700">
                <CreditCard className="h-4 w-4" /> تسجيل تحصيل
              </Button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="overflow-hidden border-none shadow-xl">
              <CardHeader className="bg-muted/50 border-b">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                       <CardTitle className="text-2xl font-black">فاتورة #{invoice.invoice_number}</CardTitle>
                       <Badge variant={paymentStatus === "paid" ? "default" : "destructive"}>
                         {paymentStatus === "paid" ? "مكتملة" : paymentStatus === "partial" ? "جزئي" : "غير مدفوعة"}
                       </Badge>
                    </div>
                    <p className="text-muted-foreground">{new Date(invoice.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-bold flex items-center gap-1 uppercase tracking-wider">
                      <User className="h-3 w-3" /> العميل
                    </p>
                    <p className="text-xl font-bold">{invoice.customers?.name}</p>
                  </div>
                  <div className="space-y-1 text-left">
                    <p className="text-xs text-muted-foreground font-bold flex items-center gap-1 justify-end uppercase tracking-wider">
                       الفني المسؤول <Wrench className="h-3 w-3" />
                    </p>
                    <p className="text-xl font-bold">{invoice.profiles?.arabic_name || "نظام آلي"}</p>
                  </div>
                </div>

                <div className="border rounded-xl overflow-hidden shadow-inner bg-card">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="text-right font-bold">الصنف</TableHead>
                        <TableHead className="text-center font-bold">الكمية</TableHead>
                        <TableHead className="text-center font-bold">السعر</TableHead>
                        <TableHead className="text-left font-bold">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoice.invoice_items?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-right">
                            {item.products?.name || `طابعة سيريال: ${item.printers?.serial_number}`}
                          </TableCell>
                          <TableCell className="text-center font-mono">{item.quantity}</TableCell>
                          <TableCell className="text-center font-mono">{Number(item.price_at_sale).toLocaleString()} ج.م</TableCell>
                          <TableCell className="text-left font-bold">{Number(item.line_total).toLocaleString()} ج.م</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col items-end gap-3 pt-4 border-t">
                  <div className="flex justify-between w-full sm:w-80">
                    <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                    <span className="font-bold">{Number(invoice.subtotal).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between w-full sm:w-80 text-primary">
                    <span className="font-bold">ضريبة القيمة المضافة ({(Number(invoice.tax_rate) * 100).toFixed(0)}%)</span>
                    <span className="font-bold">+{Number(invoice.tax_amount).toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between w-full sm:w-80 text-2xl font-black border-t pt-3">
                    <span>الإجمالي النهائي</span>
                    <span>{Number(invoice.total).toLocaleString()} ج.م</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-none shadow-xl bg-primary text-primary-foreground p-6 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-primary-foreground/80 font-bold mb-1">المتبقي للتحصيل</p>
                <p className="text-4xl font-black">{Number(invoice.remaining_amount).toLocaleString()} <span className="text-sm font-normal">ج.م</span></p>
                <div className="mt-4 pt-4 border-t border-primary-foreground/20 flex justify-between items-center">
                   <span className="text-sm">إجمالي ما تم دفعه:</span>
                   <span className="font-bold">{Number(invoice.amount_paid).toLocaleString()} ج.م</span>
                </div>
              </div>
              <Wallet className="absolute -bottom-4 -right-4 h-32 w-32 opacity-10 rotate-12" />
            </Card>

            <Card className="border-none shadow-xl">
              <CardHeader className="border-b">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <History className="h-4 w-4" /> سجل المدفوعات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableBody>
                    {invoice.payments?.length > 0 ? (
                      invoice.payments.map((p: any) => (
                        <TableRow key={p.id} className="text-xs">
                          <TableCell className="py-3">
                            <div className="font-bold">{Number(p.amount).toLocaleString()} ج.م</div>
                            <div className="text-muted-foreground text-[10px]">{new Date(p.created_at).toLocaleString("ar-EG")}</div>
                          </TableCell>
                          <TableCell className="text-left py-3">
                            <Badge variant="outline" className="text-[10px]">{p.method || p.payment_method}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell className="text-center py-6 text-muted-foreground">لا توجد مدفوعات مسجلة</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent dir="rtl" className="text-right max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6 text-primary" /> تسجيل دفعة جديدة
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitPay} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-lg">مبلغ التحصيل (ج.م) *</Label>
              <Input 
                type="number" 
                max={invoice?.remaining_amount} 
                step="0.01" 
                value={payAmount} 
                onChange={e => setPayAmount(e.target.value)} 
                className="text-center font-mono text-2xl h-14" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label>وسيلة الدفع / ملاحظات</Label>
              <Input 
                value={payMethod} 
                onChange={e => setPayMethod(e.target.value)} 
                placeholder="نقدي، تحويل، فودافون كاش..." 
                className="h-12" 
              />
            </div>
            <DialogFooter className="gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setPayOpen(false)} className="flex-1 h-12">إلغاء</Button>
              <Button type="submit" disabled={saving} className="flex-1 h-12 bg-green-600 hover:bg-green-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد الدفع"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default InvoiceDetails;
