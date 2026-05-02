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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { Plus, Loader2, ScrollText, Receipt, Calendar, User, Tag } from "lucide-react";

const CATEGORIES = [
  { value: "Bills", label: "فواتير (كهرباء/ماء)" },
  { value: "Rent", label: "إيجار" },
  { value: "Maintenance", label: "صيانة" },
  { value: "Waste", label: "نثرية" },
  { value: "Other", label: "أخرى" },
];

export const Expenses = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [category, setCategory] = useState("Other");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const load = async () => {
    setLoading(true);
    // Removing the join to ensure data shows up even if profile link is missing
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .order("date", { ascending: false });
    
    if (error) {
      console.error("Error loading expenses:", error);
      toast.error("فشل تحميل البيانات");
    } else {
      setExpenses(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("expenses").insert({
      category,
      amount: parseFloat(amount),
      notes,
      date,
      created_by: user?.id
    });
    setSaving(false);
    if (error) {
      toast.error("فشل تسجيل المصروف");
    } else {
      toast.success("تم تسجيل المصروف بنجاح");
      setOpen(false);
      setAmount("");
      setNotes("");
      load();
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-black flex items-center gap-3">
              <ScrollText className="h-10 w-10 text-primary" />
              المصاريف الإدارية
            </h1>
            <p className="text-muted-foreground mt-2 text-lg">تتبع التكاليف التشغيلية والمصاريف اليومية</p>
          </div>
          <Button onClick={() => setOpen(true)} className="shadow-lg h-12 px-6 text-lg">
            <Plus className="h-5 w-5 ml-2" /> تسجيل مصروف
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 bg-primary/5 border-none shadow-lg">
            <CardContent className="p-8 text-center space-y-2">
              <p className="text-muted-foreground font-bold">إجمالي مصاريف الفترة</p>
              <p className="text-4xl font-black text-primary">{totalExpenses.toLocaleString()} ج.م</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 border-none shadow-xl overflow-hidden">
            {loading ? (
              <div className="p-20 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الفئة</TableHead>
                      <TableHead className="text-center">المبلغ</TableHead>
                      <TableHead className="text-right">الملاحظات</TableHead>
                      <TableHead className="text-right">المسؤول</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((e) => (
                      <TableRow key={e.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                          {new Date(e.date).toLocaleDateString('ar-EG')}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="bg-muted px-2 py-1 rounded text-xs font-bold">
                            {CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-center font-black text-red-600">
                          {Number(e.amount).toLocaleString()} ج.م
                        </TableCell>
                        <TableCell className="text-right text-xs max-w-xs truncate">{e.notes || "—"}</TableCell>
                        <TableCell className="text-right font-bold text-xs">{e.profiles?.arabic_name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="text-right max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">تسجيل مصروف جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>فئة المصروف *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المبلغ (ج.م) *</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required className="h-12 text-center text-xl font-black" />
            </div>
            <div className="space-y-2">
              <Label>التاريخ</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>ملاحظات إضافية</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-12" placeholder="تفاصيل المصروف..." />
            </div>
            <DialogFooter className="mt-6">
              <Button type="submit" disabled={saving} className="w-full h-12 text-lg">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ المصروف"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};
