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
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "../components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Textarea } from "../components/ui/textarea";
import { toast } from "sonner";
import {
  Plus, Loader2, Boxes, Printer as PrinterIcon, MoreVertical,
  PackageMinus, PackagePlus, UserCheck, Pencil, Trash2, History, ArrowDownLeft, ArrowUpRight,
  Search, ArrowUpDown
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { BrandModelSelect } from "../components/BrandModelSelect";
import { useRealtime } from "../hooks/useRealtime";
import { ActivityLogTab } from "../components/ActivityLogTab";

interface Product {
  id: string; name: string; sku: string | null;
  brand_id: string; model_id: string; category: string;
  quantity: number; unit_price: number; cost_price?: number;
  low_stock_threshold: number;
}
interface Printer {
  id: string; serial_number: string;
  brand_id: string; model_id: string; status: string;
  unit_price: number; cost_price?: number; counter: number;
}
interface Tech { id: string; arabic_name: string; email: string }
interface Movement {
  id: string; created_at: string; type: 'in' | 'out';
  quantity: number; reason: string; product_name?: string;
  printer_serial?: string; performed_by?: string;
}
interface ActiveCustodyItem {
  id: string;
  assigned_quantity: number;
  used_quantity: number;
  notes: string | null;
  custody_sessions: {
    status: string;
    technician_id: string;
    profiles: {
      arabic_name: string;
    };
  };
  products: { name: string } | null;
  printers: { serial_number: string } | null;
}

const Inventory = () => {
  const { isAdmin, isStorekeeper, isTechnician, isSuperAdmin, user } = useAuth();
  const canEdit = isAdmin || isStorekeeper;
  const canDelete = isAdmin || isSuperAdmin;
  const canSeeCost = isAdmin;

  const [products, setProducts] = useState<Product[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [techs, setTechs] = useState<Tech[]>([]);
  const [loading, setLoading] = useState(true);

  // Custody Mgmt
  const [activeCustody, setActiveCustody] = useState<ActiveCustodyItem[]>([]);
  const [loadingCustody, setLoadingCustody] = useState(false);

  // Dialogs
  const [pOpen, setPOpen] = useState(false);
  const [prOpen, setPrOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [custodyOpen, setCustodyOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [pName, setPName] = useState("");
  const [pSku, setPSku] = useState("");
  const [pCat, setPCat] = useState<"spare_part" | "ink">("spare_part");
  const [pBrand, setPBrand] = useState(""); const [pModel, setPModel] = useState("");
  const [pQty, setPQty] = useState("0");
  const [pPrice, setPPrice] = useState("0");
  const [pCost, setPCost] = useState("0");
  const [pThreshold, setPThreshold] = useState("5");

  const [prSerial, setPrSerial] = useState("");
  const [prBrand, setPrBrand] = useState(""); const [prModel, setPrModel] = useState("");
  const [prPrice, setPrPrice] = useState("0");
  const [prCost, setPrCost] = useState("0");
  const [prCounter, setPrCounter] = useState("0");

  const [adjProduct, setAdjProduct] = useState<Product | null>(null);
  const [adjType, setAdjType] = useState<"add" | "deduct">("add");
  const [adjQty, setAdjQty] = useState("1");
  const [adjReason, setAdjReason] = useState("");

  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editPrinter, setEditPrinter] = useState<Printer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const [cusProduct, setCusProduct] = useState<Product | null>(null);
  const [cusPrinter, setCusPrinter] = useState<Printer | null>(null);
  const [cusTech, setCusTech] = useState("");
  const [cusQty, setCusQty] = useState("1");
  const [cusReason, setCusReason] = useState("");

  const [movements, setMovements] = useState<Movement[]>([]);
  const [selectedItemName, setSelectedItemName] = useState("");

  const [returnItem, setReturnItem] = useState<ActiveCustodyItem | null>(null);
  const [returnQty, setReturnQty] = useState("1");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredProducts = products
    .filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.sku || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      modelName(p.model_id).toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const valA = a[sortField] || "";
      const valB = b[sortField] || "";
      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const filteredPrinters = printers
    .filter(p => 
      p.serial_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
      modelName(p.model_id).toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const field = sortField === "name" ? "serial_number" : sortField;
      const valA = a[field] || "";
      const valB = b[field] || "";
      if (sortOrder === "asc") return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const load = async () => {
    setLoading(true);
    const productsTable = canSeeCost ? "products" : "products_safe";
    const printersTable = canSeeCost ? "printers" : "printers_safe";
    const [{ data: prods }, { data: prs }, { data: bs }, { data: ms }] = await (Promise.all([
      supabase.from(productsTable as any).select("*").order("created_at", { ascending: false }),
      supabase.from(printersTable as any).select("*").order("created_at", { ascending: false }),
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("models").select("id,name").order("name"),
    ]) as any);
    setProducts((prods ?? []) as Product[]);
    setPrinters((prs ?? []) as Printer[]);
    setBrands((bs ?? []) as any[]);
    setModels((ms ?? []) as any[]);
    setLoading(false);
  };

  const loadTechs = async () => {
    const { data: profs } = await (supabase.from("profiles").select("id,arabic_name,email") as any);
    setTechs((profs ?? []) as Tech[]);
  };

  const loadActiveCustody = async () => {
    if (!isAdmin && !isStorekeeper) return;
    setLoadingCustody(true);
    const { data } = await (supabase
      .from("custody_items")
      .select("*, custody_sessions!inner(status, technician_id, profiles!custody_sessions_technician_id_fkey(arabic_name)), products(name), printers(serial_number)")
      .eq("custody_sessions.status", "active")
      .order("created_at", { ascending: false }) as any);
    setActiveCustody((data as any[] ?? []) as any[]);
    setLoadingCustody(false);
  };

  useEffect(() => { load(); loadTechs(); loadActiveCustody(); }, []);
  useRealtime("inventory-rt", ["products", "printers", "custody_items"], () => { load(); loadActiveCustody(); });

  const brandName = (id: string) => brands.find((b) => b.id === id)?.name ?? "—";
  const modelName = (id: string) => models.find((m) => m.id === id)?.name ?? "—";

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: pName.trim(), 
      sku: pSku.trim() || null, 
      brand_id: pBrand, 
      model_id: pModel, 
      category: pCat,
      quantity: parseInt(pQty) || 0, 
      unit_price: parseFloat(pPrice) || 0, 
      cost_price: parseFloat(pCost) || 0
    };
    const { error } = editProduct ? await supabase.from("products").update(payload).eq("id", editProduct.id) : await supabase.from("products").insert(payload);
    setSaving(false);
    if (error) { toast.error("فشل الحفظ: " + error.message); return; }
    toast.success("تم الحفظ"); setPOpen(false); load();
  };

  const openMovementHistory = async (itemId: string, name: string, type: 'product' | 'printer') => {
    setSelectedItemName(name);
    setMovementOpen(true);
    const { data } = await (supabase
      .from("item_movement_log" as any)
      .select("*")
      .eq(type === 'product' ? 'product_id' : 'printer_id', itemId)
      .order("created_at", { ascending: false }) as any);
    setMovements((data ?? []) as Movement[]);
  };

  const openCustodyForProduct = (p: Product) => {
    setCusProduct(p);
    setCusPrinter(null);
    setCusQty("1");
    setCustodyOpen(true);
  };

  const openCustodyForPrinter = (p: Printer) => {
    setCusPrinter(p);
    setCusProduct(null);
    setCusQty("1");
    setCustodyOpen(true);
  };

  const handleReturnToInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnItem || !user) return;
    setSaving(true);
    const { error } = await (supabase.rpc("return_custody_item", {
      _custody_item_id: returnItem.id,
      _return_quantity: parseInt(returnQty),
      _admin_id: user.id
    }) as any);
    setSaving(false);
    if (error) { toast.error("فشل الاسترجاع: " + error.message); return; }
    toast.success("تم استرجاع الصنف للمخزن بنجاح");
    setReturnOpen(false);
    load();
    loadActiveCustody();
  };

  const handleAssignCustody = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cusTech || (!cusProduct && !cusPrinter)) return;
    setSaving(true);
    
    let error;
    if (cusProduct) {
      const { error: err } = await supabase.rpc("assign_custody_product", {
        _technician_id: cusTech,
        _product_id: cusProduct.id,
        _quantity: parseInt(cusQty),
        _reason: cusReason || "تسليم عهدة"
      });
      error = err;
    } else if (cusPrinter) {
      const { error: err } = await supabase.rpc("assign_custody_printer", {
        _technician_id: cusTech,
        _printer_id: cusPrinter.id,
        _reason: cusReason || "تسليم طابعة"
      });
      error = err;
    }

    setSaving(false);
    if (error) { toast.error("فشل التسليم: " + error.message); return; }
    toast.success("تم تسليم العهدة للفني بنجاح");
    setCustodyOpen(false);
    setCusTech(""); setCusReason(""); setCusQty("1");
    load(); loadActiveCustody();
  };

  const addPrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      serial_number: prSerial.trim(), brand_id: prBrand, model_id: prModel,
      unit_price: parseFloat(prPrice) || 0, cost_price: parseFloat(prCost) || 0,
      counter: parseInt(prCounter) || 0, status: 'in_stock'
    };
    const { error } = await supabase.from("printers").insert(payload);
    setSaving(false);
    if (error) { toast.error("فشل إضافة الطابعة: " + error.message); return; }
    toast.success("تمت إضافة الطابعة بنجاح");
    setPrOpen(false);
    setPrSerial(""); setPrPrice("0"); setPrCost("0"); setPrCounter("0");
    load();
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-end px-2">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black">المخـزون</h1>
            <p className="text-muted-foreground mt-1 text-base sm:text-lg">إدارة الموارد والعهد والمتابعة</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl shadow-sm border mx-2">
          <div className="relative w-full sm:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="بحث بالاسم أو الموديل أو السيريال..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10 text-right h-11"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex gap-2 text-xs text-muted-foreground items-center">
              <span>ترتيب حسب: </span>
              <button onClick={() => toggleSort("name")} className={`hover:text-primary ${sortField === "name" ? "text-primary font-bold" : ""}`}>الاسم</button>
              <span>|</span>
              <button onClick={() => toggleSort("quantity" as any)} className={`hover:text-primary ${sortField === "quantity" as any ? "text-primary font-bold" : ""}`}>الكمية</button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="products" className="w-full px-2">
          <TabsList className="bg-muted/50 p-1 mb-6 flex-wrap h-auto">
            <TabsTrigger value="products" className="gap-2 text-xs sm:text-sm flex-1"><Boxes className="h-4 w-4" />القطع والأحبار</TabsTrigger>
            <TabsTrigger value="printers" className="gap-2 text-xs sm:text-sm flex-1"><PrinterIcon className="h-4 w-4" />الطابعات</TabsTrigger>
            {isAdmin && <TabsTrigger value="custody_mgmt" className="gap-2 text-xs sm:text-sm flex-1"><UserCheck className="h-4 w-4" />إدارة العهد</TabsTrigger>}
            {isAdmin && <TabsTrigger value="logs" className="gap-2 text-xs sm:text-sm flex-1"><History className="h-4 w-4" />سجل الحركات</TabsTrigger>}
          </TabsList>

          <TabsContent value="products" className="space-y-4">
            {canEdit && (
              <div className="flex justify-end gap-2">
                <Button onClick={() => { setEditProduct(null); setPOpen(true); }} className="shadow-lg h-10 sm:h-12"><Plus className="h-4 w-4 ml-2" />منتج جديد</Button>
              </div>
            )}
            <Card className="overflow-hidden border-none shadow-xl">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right font-bold cursor-pointer" onClick={() => toggleSort("name")}>
                        الاسم <ArrowUpDown className="inline h-3 w-3 mr-1" />
                      </TableHead>
                      <TableHead className="text-right font-bold">العلامة / الموديل</TableHead>
                      <TableHead className="text-center font-bold cursor-pointer" onClick={() => toggleSort("quantity" as any)}>
                        الكمية <ArrowUpDown className="inline h-3 w-3 mr-1" />
                      </TableHead>
                      <TableHead className="text-center font-bold">السعر</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((p) => (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors text-xs sm:text-sm">
                        <TableCell className="font-bold text-right">{p.name}</TableCell>
                        <TableCell className="text-right">{brandName(p.brand_id)} / {modelName(p.model_id)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={p.quantity <= p.low_stock_threshold ? "destructive" : "secondary"} className="font-mono text-xs sm:text-base">
                            {p.quantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{Number(p.unit_price).toLocaleString()} ج.م</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openMovementHistory(p.id, p.name, 'product')} title="سجل الحركة">
                              <History className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditProduct(p); setPName(p.name); setPSku(p.sku || ""); setPBrand(p.brand_id); setPModel(p.model_id); setPCat(p.category as any); setPQty(String(p.quantity)); setPPrice(String(p.unit_price)); setPCost(String(p.cost_price || 0)); setPThreshold(String(p.low_stock_threshold)); setPOpen(true); }}>تعديل</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openCustodyForProduct(p)}>تسليم عهدة</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="printers">
             <div className="flex justify-end mb-4">
                {canEdit && <Button variant="outline" onClick={() => setPrOpen(true)} className="h-10 sm:h-12"><PrinterIcon className="h-4 w-4 ml-2" />طابعة جديدة</Button>}
             </div>
             <Card className="overflow-hidden border-none shadow-xl">
               <div className="overflow-x-auto">
                 <Table>
                   <TableHeader className="bg-muted/50">
                     <TableRow>
                       <TableHead className="text-right font-bold cursor-pointer" onClick={() => toggleSort("serial_number" as any)}>
                         الرقم التسلسلي <ArrowUpDown className="inline h-3 w-3 mr-1" />
                       </TableHead>
                       <TableHead className="text-right font-bold">العلامة / الموديل</TableHead>
                       <TableHead className="text-center font-bold">العداد</TableHead>
                       <TableHead className="text-center font-bold">السعر</TableHead>
                       <TableHead></TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {filteredPrinters.map(p => (
                       <TableRow key={p.id} className="hover:bg-muted/30 transition-colors text-xs sm:text-sm">
                         <TableCell className="font-mono text-right">{p.serial_number}</TableCell>
                         <TableCell className="text-right">{brandName(p.brand_id)} / {modelName(p.model_id)}</TableCell>
                         <TableCell className="text-center font-mono">{Number(p.counter).toLocaleString()}</TableCell>
                         <TableCell className="text-center">{Number(p.unit_price).toLocaleString()} ج.م</TableCell>
                         <TableCell className="text-center">
                            <Button size="icon" variant="ghost" onClick={() => openMovementHistory(p.id, p.serial_number, 'printer')}>
                              <History className="h-4 w-4" />
                            </Button>
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               </div>
             </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="custody_mgmt">
              <Card className="overflow-hidden border-none shadow-xl">
                {loadingCustody ? (
                  <div className="p-20 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-right">الفني</TableHead>
                          <TableHead className="text-right">الصنف</TableHead>
                          <TableHead className="text-center">المتبقي معه</TableHead>
                          <TableHead className="text-center">الإجراءات</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeCustody.map((c) => {
                          const remaining = c.assigned_quantity - c.used_quantity;
                          if (remaining <= 0) return null;
                          return (
                            <TableRow key={c.id} className="text-xs sm:text-sm">
                              <TableCell className="font-bold text-right">{c.custody_sessions.profiles?.arabic_name || "—"}</TableCell>
                              <TableCell className="text-right">{c.products?.name || c.printers?.serial_number}</TableCell>
                              <TableCell className="text-center"><Badge className="text-base sm:text-lg">{remaining}</Badge></TableCell>
                              <TableCell className="text-center">
                                <Button variant="outline" size="sm" className="gap-2 text-red-600 border-red-200 hover:bg-red-50 text-[10px] sm:text-xs" 
                                  onClick={() => { setReturnItem(c); setReturnQty(String(remaining)); setReturnOpen(true); }}>
                                  <ArrowDownLeft className="h-4 w-4" /> <span className="hidden sm:inline">استرجاع</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="logs">
              <Card className="p-6 border-none shadow-xl">
                <ActivityLogTab tableName="products" />
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Movement History Modal */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <History className="h-6 w-6 text-primary" /> سجل حركة الصنف: {selectedItemName}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto mt-4 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-center">نوع الحركة</TableHead>
                  <TableHead className="text-center">الكمية</TableHead>
                  <TableHead className="text-right">السبب / بواسطة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(m => (
                  <TableRow key={m.id} className="text-xs sm:text-sm">
                    <TableCell className="text-right">{new Date(m.created_at).toLocaleString('ar-EG')}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={m.type === 'in' ? 'default' : 'destructive'} className="gap-1 text-[10px] sm:text-xs">
                        {m.type === 'in' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {m.type === 'in' ? 'دخول' : 'خروج'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold text-center">{m.quantity}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium">{m.reason}</div>
                      <div className="text-[10px] text-muted-foreground">{m.performed_by}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return to Inventory Modal */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle>استرجاع للمخزن</DialogTitle></DialogHeader>
          <form onSubmit={handleReturnToInventory} className="space-y-4 pt-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm">الصنف: <b>{returnItem?.products?.name || returnItem?.printers?.serial_number || "—"}</b></p>
              <p className="text-sm">من الفني: <b>{returnItem?.custody_sessions?.profiles?.arabic_name || "—"}</b></p>
            </div>
            <div className="space-y-2">
              <Label>الكمية المسترجعة</Label>
              <Input type="number" value={returnQty} onChange={e => setReturnQty(e.target.value)} max={returnItem ? returnItem.assigned_quantity - returnItem.used_quantity : 0} min={1} required className="text-center font-mono text-xl h-12" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setReturnOpen(false)} className="flex-1">إلغاء</Button>
              <Button type="submit" disabled={saving} className="bg-red-600 hover:bg-red-700 flex-1">تأكيد الاسترجاع</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={pOpen} onOpenChange={setPOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>{editProduct ? "تعديل منتج" : "منتج جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={addProduct} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pName">وصف الصنف (مثال: حبر أسود)</Label>
                <Input id="pName" value={pName} onChange={(e) => setPName(e.target.value)} required placeholder="أدخل وصف الصنف" className="text-right" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pThreshold">تنبيه انخفاض المخزن (عند كمية)</Label>
                <Input id="pThreshold" type="number" value={pThreshold} onChange={(e) => setPThreshold(e.target.value)} className="text-right" />
              </div>
            </div>
            <BrandModelSelect
              type={pCat}
              brandId={pBrand}
              modelId={pModel}
              onBrandChange={setPBrand}
              onModelChange={setPModel}
              required
            />
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>الكمية</Label><Input type="number" value={pQty} onChange={e => setPQty(e.target.value)} className="text-center font-mono" /></div>
                <div className="space-y-2"><Label>السعر (ج.م)</Label><Input type="number" value={pPrice} onChange={e => setPPrice(e.target.value)} className="text-center font-mono" /></div>
            </div>
            {canSeeCost && <div className="space-y-2"><Label>التكلفة (ج.م)</Label><Input type="number" value={pCost} onChange={e => setPCost(e.target.value)} className="text-center font-mono" /></div>}
            <Button type="submit" className="w-full h-12 text-lg" disabled={saving}>{editProduct ? "تحديث المنتج" : "حفظ المنتج"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Printer Dialog */}
      <Dialog open={prOpen} onOpenChange={setPrOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader><DialogTitle>إضافة طابعة جديدة</DialogTitle></DialogHeader>
          <form onSubmit={addPrinter} className="space-y-4 pt-4">
             <div className="space-y-2"><Label>الرقم التسلسلي (Serial Number) *</Label><Input value={prSerial} onChange={e => setPrSerial(e.target.value)} required className="text-right font-mono" /></div>
             <BrandModelSelect type="printer" brandId={prBrand} modelId={prModel} onBrandChange={setPrBrand} onModelChange={setPrModel} required />
             <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>العداد</Label><Input type="number" value={prCounter} onChange={e => setPrCounter(e.target.value)} className="text-center font-mono" /></div>
                <div className="space-y-2"><Label>السعر</Label><Input type="number" value={prPrice} onChange={e => setPrPrice(e.target.value)} className="text-center font-mono" /></div>
                {canSeeCost && <div className="space-y-2"><Label>التكلفة</Label><Input type="number" value={prCost} onChange={e => setPrCost(e.target.value)} className="text-center font-mono" /></div>}
             </div>
             <Button type="submit" className="w-full h-12 text-lg" disabled={saving}>إضافة الطابعة</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deliver Custody Dialog */}
      <Dialog open={custodyOpen} onOpenChange={setCustodyOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader><DialogTitle className="text-2xl font-bold flex items-center gap-2"><UserCheck className="h-6 w-6 text-primary" /> تسليم عهدة لفني</DialogTitle></DialogHeader>
          <form onSubmit={handleAssignCustody} className="space-y-5 pt-4">
            <div className="p-4 bg-muted/50 rounded-xl border border-dashed border-primary/20">
              <p className="text-sm font-bold text-muted-foreground mb-1 uppercase">الصنف المختار</p>
              <p className="text-xl font-black">{cusProduct?.name || `طابعة: ${cusPrinter?.serial_number}`}</p>
              {cusProduct && <p className="text-xs text-primary mt-1">الكمية المتوفرة: {cusProduct.quantity}</p>}
            </div>

            <div className="space-y-2">
              <Label className="font-bold">الفني المستلم *</Label>
              <Select onValueChange={setCusTech} value={cusTech}>
                <SelectTrigger className="h-12"><SelectValue placeholder="اختر الفني من القائمة..." /></SelectTrigger>
                <SelectContent>
                  {techs.map(t => <SelectItem key={t.id} value={t.id}>{t.arabic_name} ({t.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {cusProduct && (
              <div className="space-y-2">
                <Label className="font-bold">الكمية المسلمة *</Label>
                <Input type="number" value={cusQty} onChange={e => setCusQty(e.target.value)} min={1} max={cusProduct.quantity} className="h-12 text-center font-mono text-2xl" />
              </div>
            )}

            <div className="space-y-2">
              <Label className="font-bold">ملاحظات التسليم</Label>
              <Textarea value={cusReason} onChange={e => setCusReason(e.target.value)} placeholder="رقم أمر التكليف، حالة الصنف..." className="resize-none" />
            </div>

            <DialogFooter className="gap-3">
              <Button type="button" variant="outline" onClick={() => setCustodyOpen(false)} className="flex-1 h-12">إلغاء</Button>
              <Button type="submit" disabled={saving || !cusTech} className="flex-1 h-12 text-lg">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "تأكيد التسليم"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Inventory;

