import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Card } from "../components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Loader2, ShieldCheck, Tag, User, Landmark, AlertTriangle, ArrowUpRight } from "lucide-react";

interface AuditLog {
  id: string;
  created_at: string;
  action_type: string;
  table_name: string;
  record_id: string;
  user_id: string;
  user_name: string | null;
  action?: string;
  entity_id?: string;
}

const ACTION_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  INSERT: { label: "إضافة جديدة", variant: "default" },
  UPDATE: { label: "تعديل بيانات", variant: "secondary" },
  DELETE: { label: "حذف بيانات", variant: "destructive" },
  RETURN: { label: "استرجاع للمخزن", variant: "outline" },
  password_reset: { label: "تغيير كلمة مرور", variant: "destructive" },
};

const TABLE_MAP: Record<string, string> = {
  products: "المنتجات",
  printers: "الطابعات",
  invoices: "الفواتير",
  suppliers: "الموردين",
  custody_sessions: "جلسات العهدة",
  custody_items: "أصناف العهدة",
  profiles: "المستخدمين",
  "auth.users": "حسابات الدخول",
};

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [{ data: logsData }, { data: statsData }] = await Promise.all([
        supabase.from("audit_logs_with_users" as any).select("*").order("created_at", { ascending: false }).limit(100),
        supabase.rpc("get_enhanced_stats" as any)
      ]);
      setLogs((logsData as any) ?? []);
      setStats(statsData);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="px-2">
          <h1 className="text-3xl sm:text-4xl font-black flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 sm:h-9 sm:w-9 text-primary" /> سجل العمليات والتحليلات
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-lg">تتبع جميع التحركات المالية والتقنية والأنشطة على النظام</p>
        </div>

        {stats && (
          <div className="grid md:grid-cols-3 gap-6 px-2">
            <Card className="p-6 border-none shadow-lg bg-green-50 text-green-900">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold flex items-center gap-2"><Landmark className="h-5 w-5" /> مبيعات اليوم</h3>
                  <Badge className="bg-green-600">نشط</Badge>
               </div>
               <p className="text-4xl font-black">{(stats.daily_sales || 0).toLocaleString()} <span className="text-sm font-normal">ج.م</span></p>
            </Card>

            <Card className="p-6 border-none shadow-lg bg-red-50 text-red-900">
               <h3 className="font-bold flex items-center gap-2 mb-4 text-red-700"><AlertTriangle className="h-5 w-5" /> تنبيهات مديونية (عالية)</h3>
               <div className="space-y-2">
                  {stats.debt_alerts?.length > 0 ? stats.debt_alerts.map((d: any) => (
                    <div key={d.name} className="flex justify-between text-sm border-b border-red-200 pb-1">
                      <span>{d.name}</span>
                      <span className="font-bold">{d.debt.toLocaleString()} ج.م</span>
                    </div>
                  )) : <p className="text-xs text-red-500">لا يوجد مديونيات ضخمة حالياً</p>}
               </div>
            </Card>

            <Card className="p-6 border-none shadow-lg bg-blue-50 text-blue-900">
               <h3 className="font-bold flex items-center gap-2 mb-4 text-blue-700"><ArrowUpRight className="h-5 w-5" /> الأكثر حركة (أسبوعياً)</h3>
               <div className="space-y-2">
                  {stats.top_items?.length > 0 ? stats.top_items.map((i: any) => (
                    <div key={i.item} className="flex justify-between text-sm border-b border-blue-200 pb-1">
                      <span className="truncate max-w-[150px]">{i.item}</span>
                      <Badge variant="outline" className="font-mono">{i.movement} عملية</Badge>
                    </div>
                  )) : <p className="text-xs text-blue-500">لا توجد بيانات حركة كافية</p>}
               </div>
            </Card>
          </div>
        )}

        <Card className="overflow-hidden border-none shadow-xl mx-2">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right font-bold">المستخدم</TableHead>
                    <TableHead className="text-right font-bold">العملية</TableHead>
                    <TableHead className="text-right font-bold">الجدول</TableHead>
                    <TableHead className="text-center font-bold">رقم السجل</TableHead>
                    <TableHead className="text-center font-bold">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/20 transition-colors text-xs sm:text-sm">
                      <TableCell className="font-bold text-right text-primary">
                        <div className="flex items-center gap-2 justify-start">
                          <User className="h-3 w-3 text-primary" />
                          <span>{log.user_name || "نظام آلي"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col">
                          <Badge variant={ACTION_MAP[log.action_type]?.variant || "outline"} className="w-fit">
                            {ACTION_MAP[log.action_type]?.label || log.action_type}
                          </Badge>
                          {log.action && <span className="text-[10px] text-muted-foreground mt-1">{log.action}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col gap-1 justify-start">
                          <div className="flex items-center gap-2">
                            <Tag className="h-3 w-3 text-muted-foreground" />
                            <span className="font-medium">{TABLE_MAP[log.table_name] || log.table_name}</span>
                          </div>
                          {log.entity_id && <Badge variant="outline" className="text-[9px] w-fit opacity-70">{log.entity_id}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell dir="ltr" className="text-center text-xs font-mono text-muted-foreground">
                        {log.record_id?.slice(0, 8) ?? "—"}
                      </TableCell>
                      <TableCell className="text-center whitespace-nowrap text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("ar-EG", { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AuditLogs;


