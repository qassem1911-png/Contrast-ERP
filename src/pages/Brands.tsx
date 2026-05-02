import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
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
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Brand { id: string; name: string }
interface Model { id: string; brand_id: string; name: string; type: "printer" | "spare_part" | "ink" }

const TYPE_LABEL: Record<string, string> = { printer: "طابعة", spare_part: "قطعة غيار", ink: "حبر" };

const Brands = () => {
  const { isAdmin } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string>("");

  const [bOpen, setBOpen] = useState(false);
  const [bName, setBName] = useState("");
  const [mOpen, setMOpen] = useState(false);
  const [mName, setMName] = useState("");
  const [mType, setMType] = useState<"printer" | "spare_part" | "ink">("printer");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: bs }, { data: ms }] = await Promise.all([
      supabase.from("brands").select("*").order("name"),
      supabase.from("models").select("*").order("name"),
    ]);
    setBrands((bs ?? []) as Brand[]);
    setModels((ms ?? []) as Model[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const addBrand = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const { error } = await supabase.from("brands").insert({ name: bName.trim() });
    setSaving(false);
    if (error) { toast.error("فشل الإضافة", { description: error.message }); return; }
    toast.success("تمت إضافة العلامة");
    setBOpen(false); setBName(""); load();
  };

  const addModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBrand) { toast.error("اختر علامة أولاً"); return; }
    setSaving(true);
    const { error } = await supabase.from("models").insert({
      brand_id: selectedBrand, name: mName.trim(), type: mType,
    });
    setSaving(false);
    if (error) { toast.error("فشل الإضافة", { description: error.message }); return; }
    toast.success("تمت إضافة الموديل");
    setMOpen(false); setMName(""); load();
  };

  const delBrand = async (id: string) => {
    if (!confirm("حذف العلامة وكل موديلاتها؟")) return;
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) { toast.error("فشل الحذف", { description: error.message }); return; }
    load();
  };
  const delModel = async (id: string) => {
    const { error } = await supabase.from("models").delete().eq("id", id);
    if (error) { toast.error("فشل الحذف", { description: error.message }); return; }
    load();
  };

  const filteredModels = selectedBrand ? models.filter((m) => m.brand_id === selectedBrand) : models;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold">الماركات والموديلات</h1>
          <p className="text-muted-foreground mt-1">إدارة العلامات التجارية والموديلات المرتبطة بها</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Brands */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">العلامات التجارية</h2>
              {isAdmin && <Button size="sm" onClick={() => setBOpen(true)}><Plus className="h-4 w-4 ml-1" />جديدة</Button>}
            </div>
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : brands.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد علامات</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">عدد الموديلات</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {brands.map((b) => (
                    <TableRow
                      key={b.id}
                      className={`cursor-pointer ${selectedBrand === b.id ? "bg-muted/50" : ""}`}
                      onClick={() => setSelectedBrand(b.id === selectedBrand ? "" : b.id)}
                    >
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell>{models.filter((m) => m.brand_id === b.id).length}</TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); delBrand(b.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Models */}
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold">
                الموديلات {selectedBrand && `— ${brands.find((b) => b.id === selectedBrand)?.name}`}
              </h2>
              {isAdmin && (
                <Button size="sm" disabled={!selectedBrand} onClick={() => setMOpen(true)}>
                  <Plus className="h-4 w-4 ml-1" />جديد
                </Button>
              )}
            </div>
            {!selectedBrand && <p className="text-sm text-muted-foreground text-center py-2">اختر علامة لإضافة موديل</p>}
            {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : filteredModels.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">لا توجد موديلات</p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredModels.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell><Badge variant="outline">{TYPE_LABEL[m.type]}</Badge></TableCell>
                      <TableCell>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => delModel(m.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      </div>

      {/* Brand dialog */}
      <Dialog open={bOpen} onOpenChange={setBOpen}>
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader><DialogTitle>علامة تجارية جديدة</DialogTitle></DialogHeader>
          <form onSubmit={addBrand} className="space-y-3">
            <div className="space-y-2"><Label>الاسم *</Label><Input value={bName} onChange={(e) => setBName(e.target.value)} required /></div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setBOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Model dialog */}
      <Dialog open={mOpen} onOpenChange={setMOpen}>
        <DialogContent dir="rtl" className="text-right">
          <DialogHeader>
            <DialogTitle>موديل جديد — {brands.find((b) => b.id === selectedBrand)?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={addModel} className="space-y-3">
            <div className="space-y-2"><Label>الاسم *</Label><Input value={mName} onChange={(e) => setMName(e.target.value)} required /></div>
            <div className="space-y-2">
              <Label>النوع *</Label>
              <Select value={mType} onValueChange={(v) => setMType(v as typeof mType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="printer">طابعة</SelectItem>
                  <SelectItem value="spare_part">قطعة غيار</SelectItem>
                  <SelectItem value="ink">حبر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setMOpen(false)}>إلغاء</Button>
              <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Brands;
