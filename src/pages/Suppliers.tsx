import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui/tabs";
import { ActivityLogTab } from "../components/ActivityLogTab";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2, Truck, Eye, Receipt, Landmark, Phone, Building2, Search, ArrowUpDown, CreditCard, History } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  company_name: string | null;
  created_at: string;
  total_debt?: number;
}

interface SupplierTransaction {
  id: string;
  supplier_id: string;
  item_name: string;
  price: number;
  total_amount?: number;
  paid_amount: number;
  remaining_amount: number;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

const Suppliers = () => {
  const { isAdmin, isStorekeeper, isSuperAdmin } = useAuth();
  const canEdit = isAdmin || isStorekeeper || isSuperAdmin;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");

  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [openDetails, setOpenDetails] = useState(false);

  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [itemName, setItemName] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [price, setPrice] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [qty, setQty] = useState("1");

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof Supplier>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Ledger state
  const [ledger, setLedger] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const loadLedger = async (supplierId: string) => {
    setLoadingLedger(true);
    const { data } = await supabase.rpc("get_supplier_ledger", { _supplier_id: supplierId });
    setLedger(data || []);
    setLoadingLedger(false);
  };

  const loadSuppliers = async () => {
    setLoading(true);
    const { data, error } = await (supabase.from("suppliers" as any).select(`
      *,
      supplier_transactions(remaining_amount)
    `) as any);
    
    if (error) {
      toast.error("فشل تحميل الموردين");
    } else {
      const mapped = ((data as any[]) || []).map((s: any) => ({
        ...s,
        total_debt: s.supplier_transactions?.reduce((sum: number, t: any) => sum + Number(t.remaining_amount), 0) || 0
      }));
      setSuppliers(mapped);
    }
    setLoading(false);
  };

  const loadProducts = async () => {
    const { data } = await (supabase.from("products").select("id, name").order("name") as any);
    setProducts(data || []);
  };

  useEffect(() => {
    loadSuppliers();
    loadProducts();
  }, []);

  const resetForm = () => {
    setName("");
    setPhone("");
    setCompanyName("");
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { error } = await (supabase.from("suppliers" as any).insert({
      name: name.trim(),
      phone: phone.trim() || null,
      company_name: companyName.trim() || null,
    }) as any);
    setSaving(false);
    if (error) {
      toast.error("فشل إضافة المورد");
    } else {
      toast.success("تم إضافة المورد بنجاح");
      setOpen(false);
      resetForm();
      loadSuppliers();
    }
  };

  const viewDetails = async (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setOpenDetails(true);
    setLoadingTransactions(true);
    const { data, error } = await (supabase
      .from("supplier_transactions" as any)
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false }) as any);
    
    if (error) {
      toast.error("فشل تحميل الحسابات");
    } else {
      setTransactions(data || []);
    }
    setLoadingTransactions(false);
    loadLedger(supplier.id);
  };

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !price) return;
    
    const p = parseFloat(price);
    const paid = parseFloat(paidAmount || "0");
    const remaining = p - paid;
    const finalItemName = itemName || products.find(prod => prod.id === selectedProductId)?.name || "عملية شراء";

    setSaving(true);
    const { data: tx, error: txError } = await supabase.from("supplier_transactions" as any).insert({
      supplier_id: selectedSupplier.id,
      item_name: finalItemName,
      total_amount: p,
      price: p,
      paid_amount: paid || 0,
      remaining_amount: remaining,
    }).select().single();

    if (txError) {
      toast.error("فشل إضافة العملية");
      setSaving(false);
      return;
    }

    if (selectedProductId) {
      const { error: itemError } = await supabase.from("supplier_transaction_items" as any).insert({
        transaction_id: tx.id,
        product_id: selectedProductId,
        quantity: parseInt(qty),
        unit_price: p / parseInt(qty),
        subtotal: p
      });
      if (itemError) toast.error("فشل تحديث المخزون");
    }

    setSaving(false);
    toast.success("تم تسجيل العملية وتحديث المخزون");
    setItemName("");
    setPrice("");
    setPaidAmount("");
    setQty("1");
    setSelectedProductId(null);
    setShowAddTransaction(false);
    viewDetails(selectedSupplier);
    loadSuppliers();
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || !paymentAmount) return;

    setSaving(true);
    const { error } = await supabase.from("supplier_payments" as any).insert({
      supplier_id: selectedSupplier.id,
      amount: parseFloat(paymentAmount),
      notes: paymentNotes,
      method: "cash"
    });

    setSaving(false);
    if (error) {
      toast.error("فشل تسجيل الدفعة");
    } else {
      toast.success("تم تسجيل الدفعة بنجاح");
      setPaymentAmount("");
      setPaymentNotes("");
      setShowAddPayment(false);
      viewDetails(selectedSupplier);
      loadSuppliers();
    }
  };

  const totalPaid = transactions.reduce((sum, t) => sum + Number(t.paid_amount), 0);
  const totalDebt = transactions.reduce((sum, t) => sum + Number(t.remaining_amount), 0);

  const filteredSuppliers = suppliers
    .filter(s => 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.company_name?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const toggleSort = (field: keyof Supplier) => {
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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3">
              <Truck className="h-8 w-8 sm:h-9 sm:w-9 text-primary" />
              الموردين والحسابات
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-lg">إدارة بيانات الموردين ومتابعة المديونيات وتحديث المخزون</p>
          </div>
          {canEdit && (
            <Button onClick={() => setOpen(true)} className="shadow-lg h-10 sm:h-12 px-4 sm:px-6">
              <Plus className="h-5 w-5 ml-2" /> مورد جديد
            </Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl shadow-sm border">
          <div className="relative w-full sm:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث باسم المورد أو الشركة..." 
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
            <div className="p-20 flex justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-20 text-center text-muted-foreground">لا يوجد موردين يطابقون البحث</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right font-bold cursor-pointer" onClick={() => toggleSort("name")}>
                      اسم المورد <ArrowUpDown className="inline h-3 w-3 mr-1" />
                    </TableHead>
                    <TableHead className="text-right font-bold">الشركة</TableHead>
                    <TableHead className="text-center font-bold">رقم الهاتف</TableHead>
                    <TableHead className="text-center font-bold">إجمالي الدين</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/30 transition-colors text-xs sm:text-sm">
                      <TableCell className="font-bold text-right text-lg">{s.name}</TableCell>
                      <TableCell className="text-right">{s.company_name || "—"}</TableCell>
                      <TableCell className="text-center font-mono">{s.phone || "—"}</TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={s.total_debt && s.total_debt > 0 ? "text-red-600" : "text-green-600"}>
                          {(s.total_debt || 0).toLocaleString()} ج.م
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="gap-2 border-primary/20 hover:border-primary hover:bg-primary/5 text-xs sm:text-sm"
                          onClick={() => viewDetails(s)}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">كشف حساب</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* Add Supplier Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="text-right max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">إضافة مورد جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSupplier} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم المورد *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="text-right h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">اسم الشركة</Label>
              <Input id="company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="text-right h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="text-right h-12" />
            </div>
            <DialogFooter className="mt-6 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1 h-12">إلغاء</Button>
              <Button type="submit" disabled={saving} className="flex-1 h-12">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة المورد"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Supplier Details Dialog */}
      <Dialog open={openDetails} onOpenChange={setOpenDetails}>
        <DialogContent dir="rtl" className="text-right max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between border-b pb-4 mb-4 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-full">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-3xl font-black">{selectedSupplier?.name}</DialogTitle>
                <p className="text-muted-foreground flex items-center gap-2 mt-1">
                  <Phone className="h-4 w-4" /> {selectedSupplier?.phone || "بدون هاتف"} 
                  {selectedSupplier?.company_name && ` | ${selectedSupplier.company_name}`}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
               <div className="bg-green-50 text-green-700 p-3 sm:p-4 rounded-xl border border-green-200 text-center min-w-[120px]">
                  <p className="text-xs font-bold mb-1">إجمالي المدفوع</p>
                  <p className="text-xl sm:text-2xl font-black">{totalPaid.toLocaleString()} ج.م</p>
               </div>
               <div className="bg-red-50 text-red-700 p-3 sm:p-4 rounded-xl border border-red-200 text-center min-w-[120px]">
                  <p className="text-xs font-bold mb-1">إجمالي المتبقي (دين)</p>
                  <p className="text-xl sm:text-2xl font-black">{totalDebt.toLocaleString()} ج.م</p>
               </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            <Tabs defaultValue="ledger" className="w-full">
              <TabsList className="bg-muted/50 p-1 mb-4">
                <TabsTrigger value="ledger" className="gap-2 flex-1"><Landmark className="h-4 w-4" /> كشف الحساب (Ledger)</TabsTrigger>
                <TabsTrigger value="transactions" className="gap-2 flex-1"><Receipt className="h-4 w-4" /> الفواتير والمقبوضات</TabsTrigger>
                {isAdmin && <TabsTrigger value="logs" className="gap-2 flex-1"><History className="h-4 w-4" /> سجل الحركات</TabsTrigger>}
              </TabsList>

              <TabsContent value="ledger" className="space-y-4">
                 {loadingLedger ? (
                   <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                 ) : (
                   <div className="rounded-xl border bg-card overflow-hidden">
                     <Table>
                       <TableHeader className="bg-muted/50">
                         <TableRow>
                           <TableHead className="text-right">التاريخ</TableHead>
                           <TableHead className="text-right">البيان</TableHead>
                           <TableHead className="text-center">مدين (+)</TableHead>
                           <TableHead className="text-center">دائن (-)</TableHead>
                           <TableHead className="text-center">الرصيد الجديد</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {ledger.map((row, idx) => (
                           <TableRow key={idx} className="hover:bg-muted/30 transition-colors text-xs sm:text-sm">
                             <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                               {new Date(row.date).toLocaleDateString('ar-EG')}
                             </TableCell>
                             <TableCell className="text-right font-bold">{row.description}</TableCell>
                             <TableCell className="text-center font-mono text-red-600">{row.debit > 0 ? `+${Number(row.debit).toLocaleString()}` : '—'}</TableCell>
                             <TableCell className="text-center font-mono text-green-600">{row.credit > 0 ? `-${Number(row.credit).toLocaleString()}` : '—'}</TableCell>
                             <TableCell className="text-center font-black bg-muted/20">{Number(row.balance).toLocaleString()} ج.م</TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 )}
              </TabsContent>

              <TabsContent value="transactions" className="space-y-4">
                <div className="flex justify-between items-center flex-wrap gap-4 pt-2">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Receipt className="h-5 w-5 text-primary" /> سجل المعاملات المالية
                  </h3>
                  <div className="flex gap-2">
                    {canEdit && (
                      <>
                        <Button variant={showAddPayment ? "default" : "outline"} onClick={() => { setShowAddPayment(!showAddPayment); setShowAddTransaction(false); }} className="gap-2 border-green-600 text-green-700 hover:bg-green-50">
                          <CreditCard className="h-4 w-4" /> تسديد دفعة
                        </Button>
                        <Button variant={showAddTransaction ? "default" : "outline"} onClick={() => { setShowAddTransaction(!showAddTransaction); setShowAddPayment(false); }} className="gap-2">
                          {showAddTransaction ? "إلغاء" : <><Plus className="h-4 w-4" /> إضافة فاتورة</>}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {showAddPayment && (
                  <Card className="bg-green-50/50 border-dashed border-2 border-green-200 shadow-inner">
                    <CardContent className="pt-6">
                      <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                          <Label>مبلغ الدفعة (ج.م)</Label>
                          <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="0.00" required className="h-10 text-center font-mono" />
                        </div>
                        <div className="space-y-2">
                          <Label>ملاحظات</Label>
                          <Input value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="مثلاً: تحويل بنكي..." className="h-10" />
                        </div>
                        <Button type="submit" disabled={saving} className="bg-green-600 hover:bg-green-700 gap-2 h-10">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                          تسجيل الدفعة
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {showAddTransaction && (
                  <Card className="bg-muted/30 border-dashed border-2 shadow-inner">
                    <CardContent className="pt-6">
                      <form onSubmit={handleAddTransaction} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>اختيار منتج (لتحديث المخزون)</Label>
                            <Select onValueChange={setSelectedProductId} value={selectedProductId || undefined}>
                              <SelectTrigger className="h-10 text-right"><SelectValue placeholder="اختر منتج..." /></SelectTrigger>
                              <SelectContent>
                                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>أو كتابة اسم العملية يدوياً</Label>
                            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="وصف البضاعة..." className="h-10" />
                          </div>
                          <div className="space-y-2">
                            <Label>الكمية المشتراة</Label>
                            <Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} min="1" className="h-10 text-center font-mono" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div className="space-y-2">
                            <Label>المبلغ الكلي (ج.م)</Label>
                            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required className="h-10 text-center font-mono" />
                          </div>
                          <div className="space-y-2">
                            <Label>المبلغ المدفوع</Label>
                            <Input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="0.00" className="h-10 text-center font-mono" />
                          </div>
                          <Button type="submit" disabled={saving} className="gap-2 h-10 w-full">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            تسجيل العملية وتحديث المخزن
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-right font-bold">التاريخ</TableHead>
                        <TableHead className="text-right font-bold">البيان / الصنف</TableHead>
                        <TableHead className="text-center font-bold">السعر الكلي</TableHead>
                        <TableHead className="text-center font-bold">المدفوع</TableHead>
                        <TableHead className="text-center font-bold">المتبقي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingTransactions ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
                      ) : transactions.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">لا يوجد أي معاملات مسجلة لهذا المورد حتى الآن</TableCell></TableRow>
                      ) : (
                        transactions.map((t) => (
                          <TableRow key={t.id} className="hover:bg-muted/10 transition-colors text-xs sm:text-sm">
                            <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                              {new Date(t.created_at).toLocaleDateString('ar-EG')}
                            </TableCell>
                            <TableCell className="font-bold text-right">{t.item_name}</TableCell>
                            <TableCell className="text-center font-mono">{Number(t.price || t.total_amount || 0).toLocaleString()} ج.م</TableCell>
                            <TableCell className="text-center font-mono text-green-600 font-bold">
                              {Number(t.paid_amount).toLocaleString()} ج.م
                            </TableCell>
                            <TableCell className={`text-center font-mono font-black ${Number(t.remaining_amount) > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                              {Number(t.remaining_amount).toLocaleString()} ج.م
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
                  <ActivityLogTab tableName="supplier_transactions" recordId={selectedSupplier?.id} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Suppliers;
