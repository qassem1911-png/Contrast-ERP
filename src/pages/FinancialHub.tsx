import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { 
  BarChart3, Landmark, AlertTriangle, Boxes, TrendingUp, 
  ArrowUpRight, ArrowDownRight, Wallet, History
} from "lucide-react";
import { Loader2 } from "lucide-react";

export const FinancialHub = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("get_financial_hub_stats");
    setStats(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  const cards = [
    { label: "السيولة المتاحة", value: stats?.liquidity, icon: Wallet, color: "text-green-600", bg: "bg-green-50" },
    { label: "إجمالي الديون", value: stats?.accounts_payable, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
    { label: "قيمة المخزون", value: stats?.inventory_value, icon: Boxes, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "صافي الأرباح", value: stats?.net_profit, icon: TrendingUp, color: "text-primary", bg: "bg-primary/5" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-black flex items-center gap-3">
            <Landmark className="h-10 w-10 text-primary" />
            المركز المالي (Kentroast)
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">الذكاء المالي والتحليلات النقدية الموحدة</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((c) => (
            <Card key={c.label} className="border-none shadow-lg overflow-hidden group">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`${c.bg} p-3 rounded-xl transition-transform group-hover:scale-110`}>
                    <c.icon className={`h-6 w-6 ${c.color}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-muted-foreground">{c.label}</p>
                  <p className={`text-2xl font-black ${c.color}`}>
                    {Number(c.value).toLocaleString()} <span className="text-xs">ج.م</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-none shadow-xl bg-card">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <ArrowUpRight className="h-5 w-5 text-green-600" />
                تحليل الإيرادات والمصروفات
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-xl">
                <span className="font-bold">إجمالي المقبوضات (الفواتير)</span>
                <span className="text-xl font-black text-green-700">{Number(stats?.total_revenue).toLocaleString()} ج.م</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-red-50 rounded-xl">
                <span className="font-bold">إجمالي المصاريف (إدارية + موردين)</span>
                <span className="text-xl font-black text-red-700">{Number(stats?.total_expenses + (stats?.total_revenue - stats?.liquidity - stats?.total_expenses)).toLocaleString()} ج.م</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-card">
            <CardHeader className="border-b pb-4">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                التدفق النقدي الأخير
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                سيتم تفعيل الرسوم البيانية للتدفق النقدي قريباً
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
