import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, FilePlus2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CustodyItem {
  custody_item_id: string;
  product_id: string | null;
  printer_id: string | null;
  item_name: string;
  brand_name: string | null;
  model_name: string | null;
  remaining_quantity: number;
  unit_price: number;
}

interface Customer { id: string; name: string }

interface LineItem {
  custody_item_id: string;
  product_id: string | null;
  printer_id: string | null;
  name: string;
  quantity: number;
  price_at_sale: number;
  max: number;
}

const NewInvoice = () => {
  const navigate = useNavigate();
  const [custody, setCustody] = useState<CustodyItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState("0");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [pickId, setPickId] = useState("");
  const [applyVat, setApplyVat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: cust }, { data: custs }] = await Promise.all([
        supabase.rpc("my_custody"),
        supabase.from("customers").select("id,name").order("name"),
      ]);
      setCustody((cust ?? []) as CustodyItem[]);
      setCustomers((custs ?? []) as Customer[]);
      setLoading(false);
    })();
  }, []);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.quantity * l.price_at_sale, 0),
    [lines]
  );
  const taxAmount = useMemo(
    () => (applyVat ? Math.round(subtotal * 0.14 * 100) / 100 : 0),
    [subtotal, applyVat]
  );
  const total = subtotal + taxAmount;

  const availableToAdd = custody.filter(
    (c) => c.remaining_quantity > 0 && !lines.find((l) => l.custody_item_id === c.custody_item_id)
  );

  const addLine = () => {
    const item = custody.find((c) => c.custody_item_id === pickId);
    if (!item) return;
    setLines([
      ...lines,
      {
        custody_item_id: item.custody_item_id,
        product_id: item.product_id,
        printer_id: item.printer_id,
        name: item.item_name,
        quantity: 1,
        price_at_sale: Number(item.unit_price) || 0,
        max: item.remaining_quantity,
      },
    ]);
    setPickId("");
  };

  const updateLine = (idx: number, patch: Partial<LineItem>) => {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const removeLine = (idx: number) => {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  };

  const submit = async () => {
    if (!customerId) { toast.error("اختر العميل"); return; }
    if (lines.length === 0) { toast.error("أضف صنفًا واحدًا على الأقل"); return; }
    for (const l of lines) {
      if (l.quantity <= 0) { toast.error(`الكمية يجب أن تكون أكبر من صفر (${l.name})`); return; }
      if (l.quantity > l.max) { toast.error(`الكمية تتجاوز المتاح في ${l.name} (${l.max})`); return; }
      if (l.price_at_sale < 0) { toast.error(`السعر غير صالح (${l.name})`); return; }
    }
    setSaving(true);
    const payloadItems = lines.map((l) => ({
      custody_item_id: l.custody_item_id,
      product_id: l.product_id,
      printer_id: l.printer_id,
      quantity: l.quantity,
      price_at_sale: l.price_at_sale,
    }));
    const { data, error } = await supabase.rpc("create_invoice", {
      _customer_id: customerId,
      _items: payloadItems,
      _amount_paid: parseFloat(amountPaid) || 0,
      _notes: notes.trim() || null,
      _subtotal: subtotal,
      _tax_amount: taxAmount,
      _total: total,
      _apply_vat: applyVat,
    });
    setSaving(false);
    if (error) { toast.error("فشل إنشاء الفاتورة", { description: error.message }); return; }
    toast.success("تم إنشاء الفاتورة بنجاح");
    navigate("/invoices");
  };

  const paid = parseFloat(amountPaid) || 0;
  const remaining = Math.max(total - paid, 0);
  const status = paid <= 0 ? "غير مدفوعة" : paid >= total ? "مدفوعة" : "جزئية";

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold flex items-center gap-2">
            <FilePlus2 className="h-7 w-7" />فاتورة صيانة جديدة
          </h1>
          <p className="text-muted-foreground mt-1">الأصناف المتاحة من عهدتك فقط</p>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Card className="p-4 space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>العميل *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">لا يوجد عملاء</div>}
                      {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="رقم البلاغ، تفاصيل…" />
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="font-semibold">أصناف الفاتورة</h3>
                <div className="flex gap-2 flex-1 max-w-md">
                  <Select value={pickId} onValueChange={setPickId}>
                    <SelectTrigger>
                      <SelectValue placeholder={availableToAdd.length === 0 ? "لا توجد أصناف متاحة" : "اختر صنفًا من العهدة"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAdd.map((c) => (
                        <SelectItem key={c.custody_item_id} value={c.custody_item_id}>
                          {c.item_name} — متاح {c.remaining_quantity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addLine} disabled={!pickId}>
                    <Plus className="h-4 w-4 ml-1" />إضافة
                  </Button>
                </div>
              </div>

              {lines.length === 0 ? (
                <div className="text-center text-muted-foreground py-6 text-sm">لم تُضَف أصناف بعد</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الصنف</TableHead>
                        <TableHead className="text-right w-24">الكمية</TableHead>
                        <TableHead className="text-right w-28">السعر</TableHead>
                        <TableHead className="text-right">الإجمالي</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lines.map((l, i) => (
                        <TableRow key={l.custody_item_id}>
                          <TableCell>
                            <div className="font-medium">{l.name}</div>
                            <div className="text-xs text-muted-foreground">المتاح: {l.max}</div>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={1} max={l.max} value={l.quantity}
                              onChange={(e) => updateLine(i, { quantity: parseInt(e.target.value) || 0 })}
                              dir="ltr" className="text-right h-9" />
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.01" value={l.price_at_sale}
                              onChange={(e) => updateLine(i, { price_at_sale: parseFloat(e.target.value) || 0 })}
                              dir="ltr" className="text-right h-9" />
                          </TableCell>
                          <TableCell className="font-semibold">{(l.quantity * l.price_at_sale).toLocaleString()}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" onClick={() => removeLine(i)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>

            <Card className="p-4 space-y-4">
              <h3 className="font-semibold">الدفع</h3>

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="text-sm">تطبيق ضريبة القيمة المضافة (14%)</Label>
                  <p className="text-xs text-muted-foreground">سيتم إضافة الضريبة إلى الإجمالي</p>
                </div>
                <Switch checked={applyVat} onCheckedChange={setApplyVat} />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الإجمالي قبل الضريبة</span>
                  <span className="font-semibold">{subtotal.toLocaleString()}</span>
                </div>
                {applyVat && (
                  <div className="flex justify-between text-primary">
                    <span>ضريبة القيمة المضافة (14%)</span>
                    <span className="font-semibold">{taxAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base border-t pt-2">
                  <span className="font-bold">الإجمالي النهائي</span>
                  <span className="text-2xl font-bold">{total.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>المبلغ المدفوع</Label>
                  <Input type="number" min={0} max={total} step="0.01" value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)} dir="ltr" className="text-right" />
                </div>
                <div className="space-y-2">
                  <Label>المتبقي</Label>
                  <div className="flex items-center gap-2">
                    <div className="text-2xl font-bold">{remaining.toLocaleString()}</div>
                    <Badge variant={paid >= total && total > 0 ? "default" : paid > 0 ? "secondary" : "destructive"}>
                      {status}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>إلغاء</Button>
              <Button onClick={submit} disabled={saving || lines.length === 0 || !customerId}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "إنشاء الفاتورة"}
              </Button>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default NewInvoice;
