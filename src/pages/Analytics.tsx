import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, DollarSign, Activity, Loader2, Trophy, Wrench
} from "lucide-react";

export const Analytics = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    monthlyProfitVsExpense: [],
    topSellingItems: [],
    technicianEfficiency: [],
    totals: { revenue: 0, expenses: 0, profit: 0 }
  });

  const loadData = async () => {
    setLoading(true);
    
    // 1. Fetch Invoices with Items & Technician
    const { data: invoices } = await supabase.from("invoices").select(`
      total, amount_paid, created_at,
      profiles!invoices_technician_id_fkey(arabic_name),
      invoice_items(quantity, unit_price, products(name), printers(serial_number))
    `);

    // 2. Fetch Expenses
    const { data: expenses } = await supabase.from("expenses").select("amount, date");

    // --- Processing: Monthly Profit vs Expenses ---
    const monthlyMap = new Map();
    let totalRev = 0;
    let totalExp = 0;

    (invoices || []).forEach(inv => {
      const month = new Date(inv.created_at).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
      if (!monthlyMap.has(month)) monthlyMap.set(month, { name: month, profit: 0, expense: 0 });
      monthlyMap.get(month).profit += Number(inv.amount_paid);
      totalRev += Number(inv.amount_paid);
    });

    (expenses || []).forEach(exp => {
      const month = new Date(exp.date).toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' });
      if (!monthlyMap.has(month)) monthlyMap.set(month, { name: month, profit: 0, expense: 0 });
      monthlyMap.get(month).expense += Number(exp.amount);
      totalExp += Number(exp.amount);
    });

    // --- Processing: Top 5 Selling Items ---
    const itemsMap = new Map();
    (invoices || []).forEach((inv: any) => {
      (inv.invoice_items || []).forEach((item: any) => {
        const name = item.products?.name || `طابعة ${item.printers?.serial_number || ''}`;
        if (!name) return;
        itemsMap.set(name, (itemsMap.get(name) || 0) + Number(item.quantity));
      });
    });
    const topItems = Array.from(itemsMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // --- Processing: Technician Efficiency ---
    const techMap = new Map();
    (invoices || []).forEach((inv: any) => {
      const techName = inv.profiles?.arabic_name || "غير محدد";
      techMap.set(techName, (techMap.get(techName) || 0) + Number(inv.amount_paid));
    });
    const techEfficiency = Array.from(techMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    setData({
      monthlyProfitVsExpense: Array.from(monthlyMap.values()).reverse().slice(-6), // Last 6 months
      topSellingItems: topItems,
      technicianEfficiency: techEfficiency,
      totals: {
        revenue: totalRev,
        expenses: totalExp,
        profit: totalRev - totalExp
      }
    });
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-screen"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
    </DashboardLayout>
  );

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1'];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8 px-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Activity className="h-10 w-10 text-primary" /> تقارير الإدارة العليا (CEO Dashboard)
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">التحليلات الذكية الشاملة لدعم اتخاذ القرار</p>
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-none shadow-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-3 bg-white/20 rounded-xl"><TrendingUp className="h-6 w-6" /></div>
              </div>
              <p className="text-sm font-bold opacity-90 mb-1">إجمالي الإيرادات المحصلة</p>
              <p className="text-4xl font-black">{data.totals.revenue.toLocaleString()} <span className="text-base font-normal opacity-80">ج.م</span></p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-3 bg-white/20 rounded-xl"><TrendingDown className="h-6 w-6" /></div>
              </div>
              <p className="text-sm font-bold opacity-90 mb-1">إجمالي المصروفات التشغيلية</p>
              <p className="text-4xl font-black">{data.totals.expenses.toLocaleString()} <span className="text-base font-normal opacity-80">ج.م</span></p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white hover:scale-[1.02] transition-transform">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                 <div className="p-3 bg-white/20 rounded-xl"><DollarSign className="h-6 w-6" /></div>
              </div>
              <p className="text-sm font-bold opacity-90 mb-1">صافي الأرباح (السيولة)</p>
              <p className="text-4xl font-black">{data.totals.profit.toLocaleString()} <span className="text-base font-normal opacity-80">ج.م</span></p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           
           {/* Monthly Profit vs Expenses */}
           <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> الأرباح مقابل المصروفات (شهرياً)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] pt-6">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthlyProfitVsExpense}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                       <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                       <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                       <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       <Legend wrapperStyle={{paddingTop: '20px'}} />
                       <Bar dataKey="profit" name="المقبوضات" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                       <Bar dataKey="expense" name="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
                    </BarChart>
                 </ResponsiveContainer>
              </CardContent>
           </Card>

           {/* Technician Efficiency */}
           <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
              <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" /> كفاءة الفنيين (حجم التحصيل)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] pt-6 flex items-center justify-center">
                 <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                       <Pie 
                         data={data.technicianEfficiency} 
                         innerRadius={70} 
                         outerRadius={110} 
                         paddingAngle={5} 
                         dataKey="value"
                         nameKey="name"
                         label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                         labelLine={false}
                       >
                          {data.technicianEfficiency.map((_: any, index: number) => (
                             <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                       </Pie>
                       <RechartsTooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    </PieChart>
                 </ResponsiveContainer>
              </CardContent>
           </Card>

           {/* Top 5 Selling Items */}
           <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm lg:col-span-2">
              <CardHeader className="border-b bg-slate-50/50">
                <CardTitle className="text-xl font-black flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-amber-500" /> أكثر 5 أصناف مبيعاً
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[350px] pt-6">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.topSellingItems} layout="vertical" margin={{ left: 50 }}>
                       <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                       <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                       <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#334155', fontWeight: 'bold'}} width={150} />
                       <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                       <Bar dataKey="quantity" name="الكمية المباعة" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={25}>
                         {data.topSellingItems.map((_: any, index: number) => (
                           <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                         ))}
                       </Bar>
                    </BarChart>
                 </ResponsiveContainer>
              </CardContent>
           </Card>

        </div>
      </div>
    </DashboardLayout>
  );
};
