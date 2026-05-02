import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Loader2, Package, History, Clock, CheckCircle2, Wrench } from "lucide-react";

interface CustodyItem {
  id: string;
  assigned_quantity: number;
  used_quantity: number;
  notes: string | null;
  products: { name: string } | null;
  printers: { serial_number: string } | null;
}

interface CustodySession {
  id: string;
  status: 'active' | 'closed';
  opened_at: string;
  closed_at: string | null;
  custody_items: CustodyItem[];
}

const MyCustody = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CustodySession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("custody_sessions")
      .select(`
        id, status, opened_at, closed_at,
        custody_items (
          id, assigned_quantity, used_quantity, notes,
          products (name),
          printers (serial_number)
        )
      `)
      .eq("technician_id", user.id)
      .order("opened_at", { ascending: false });

    if (!error && data) {
      setSessions(data as any);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const activeSessions = sessions.filter(s => s.status === 'active');
  const closedSessions = sessions.filter(s => s.status === 'closed');

  const SessionCard = ({ session }: { session: CustodySession }) => (
    <Card key={session.id} className="overflow-hidden border-none shadow-lg mb-6">
      <CardHeader className="bg-muted/30 flex flex-row items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Badge variant={session.status === 'active' ? "default" : "secondary"} className="h-6">
            {session.status === 'active' ? "عهدة نشطة" : "عهدة مغلقة"}
          </Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {new Date(session.opened_at).toLocaleDateString("ar-EG")}
          </span>
          {session.closed_at && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" /> {new Date(session.closed_at).toLocaleDateString("ar-EG")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right font-bold">الصنف</TableHead>
                <TableHead className="text-center font-bold">المستلم</TableHead>
                <TableHead className="text-center font-bold">المستخدم</TableHead>
                <TableHead className="text-center font-bold">المتبقي</TableHead>
                <TableHead className="text-right font-bold">ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {session.custody_items.map((it) => {
                const remaining = it.assigned_quantity - it.used_quantity;
                return (
                  <TableRow key={it.id} className="text-xs sm:text-sm">
                    <TableCell className="font-bold text-right">{it.products?.name || it.printers?.serial_number}</TableCell>
                    <TableCell className="text-center font-mono">{it.assigned_quantity}</TableCell>
                    <TableCell className="text-center font-mono text-blue-600">{it.used_quantity}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={remaining > 0 ? "default" : "secondary"} className="font-mono">
                        {remaining}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground italic text-[10px] sm:text-xs">{it.notes || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 px-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3">
              <Package className="h-8 w-8 sm:h-9 sm:w-9 text-primary" /> عهدتي الشخصية
            </h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-lg">متابعة الأصناف المستلمة والمسجلة في عهدتك</p>
          </div>
        </div>

        <Tabs defaultValue="active" className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8">
            <TabsTrigger value="active" className="gap-2">
              <Clock className="h-4 w-4" />
              العهدة الحالية
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              السجل السابق
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-6">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">جاري تحميل العهدة النشطة...</p>
              </div>
            ) : activeSessions.length === 0 ? (
              <Card className="p-16 text-center border-dashed border-2">
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-muted p-4 rounded-full"><Wrench className="h-10 w-10 text-muted-foreground" /></div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">لا توجد عهدة نشطة حالياً</h3>
                    <p className="text-muted-foreground text-sm">سيظهر هنا أي صنف يتم تسليمه إليك من قبل المستودع</p>
                  </div>
                </div>
              </Card>
            ) : (
              activeSessions.map(session => <SessionCard key={session.id} session={session} />)
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {loading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">جاري تحميل السجل...</p>
              </div>
            ) : closedSessions.length === 0 ? (
              <Card className="p-16 text-center border-dashed border-2">
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-muted p-4 rounded-full"><History className="h-10 w-10 text-muted-foreground" /></div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold">السجل فارغ</h3>
                    <p className="text-muted-foreground text-sm">الجلسات المغلقة ستظهر هنا للرجوع إليها لاحقاً</p>
                  </div>
                </div>
              </Card>
            ) : (
              closedSessions.map(session => <SessionCard key={session.id} session={session} />)
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MyCustody;

