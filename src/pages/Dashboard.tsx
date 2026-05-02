import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ROLE_LABELS_AR, ROLE_BADGE_VARIANTS } from "../lib/roles";
import { Boxes, FileText, Users, Wrench, AlertTriangle, Clock } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useRealtime } from "../hooks/useRealtime";

interface LowStock { product_id: string; name: string; quantity: number; low_stock_threshold: number }
interface CustodyActivity {
  session_id: string;
  technician_id: string;
  technician_name: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  items_count: number;
}

const Dashboard = () => {
  const { profile, roles, isSuperAdmin, isAdmin, isStorekeeper, isTechnician } = useAuth();
  const [lowStock, setLowStock] = useState<LowStock[]>([]);
  const [activity, setActivity] = useState<CustodyActivity[]>([]);

  const loadAlerts = async () => {
    if (!(isAdmin || isStorekeeper)) return;
    const { data } = await supabase.rpc("low_stock_alerts");
    setLowStock((data ?? []) as LowStock[]);
  };
  const loadActivity = async () => {
    const { data } = await supabase.rpc("custody_activity_24h");
    setActivity((data ?? []) as CustodyActivity[]);
  };

  useEffect(() => {
    loadAlerts();
    loadActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isStorekeeper]);

  useRealtime("dashboard-rt", ["products", "custody_sessions", "custody_items"], () => {
    loadAlerts();
    loadActivity();
  });

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">
            أهلاً، {profile?.arabic_name || "بك"} 👋
          </h1>
          <p className="text-muted-foreground">إليك نظرة سريعة على لوحة التحكم</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {roles.map((r) => (
              <Badge key={r} variant={ROLE_BADGE_VARIANTS[r]}>
                {ROLE_LABELS_AR[r]}
              </Badge>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {isAdmin && (
            <StatCard icon={FileText} label="الفواتير" value="—" hint="مفعّل" />
          )}
          {(isAdmin || isStorekeeper) && (
            <StatCard
              icon={Boxes}
              label="تنبيهات المخزون المنخفض"
              value={String(lowStock.length)}
              hint={lowStock.length > 0 ? "تحتاج إعادة تعبئة" : "كل شيء على ما يرام"}
              tone={lowStock.length > 0 ? "warn" : undefined}
            />
          )}
          <StatCard
            icon={Wrench}
            label="نشاط العهدة (24 ساعة)"
            value={String(activity.length)}
            hint={isTechnician && !isAdmin ? "حسب عهدتك" : "كل الفنيين"}
          />
          {isSuperAdmin && (
            <StatCard icon={Users} label="إدارة المستخدمين" value="✓" hint="مفعّل" />
          )}
        </div>

        {(isAdmin || isStorekeeper) && lowStock.length > 0 && (
          <Card className="p-5 border-warning/40">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <h2 className="text-xl font-bold">قطع غيار/أحبار قاربت على النفاد</h2>
            </div>
            <ul className="divide-y">
              {lowStock.map((p) => (
                <li key={p.product_id} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-medium">{p.name}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="destructive">{p.quantity}</Badge>
                    <span className="text-muted-foreground">/ حد التنبيه {p.low_stock_threshold}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">حركة العهدة خلال آخر 24 ساعة</h2>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد حركة في آخر 24 ساعة.</p>
          ) : (
            <ul className="divide-y">
              {activity.map((a) => (
                <li key={a.session_id} className="py-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{a.technician_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      فُتحت: {new Date(a.opened_at).toLocaleString("ar-EG")}
                      {a.closed_at && <> · أُغلقت: {new Date(a.closed_at).toLocaleString("ar-EG")}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={a.status === "active" ? "default" : "secondary"}>
                      {a.status === "active" ? "نشطة" : "مغلقة"}
                    </Badge>
                    <Badge variant="outline">{a.items_count} صنف</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "warn";
}) => (
  <Card className={`p-5 shadow-soft hover:shadow-elegant transition-smooth ${tone === "warn" ? "border-destructive/40" : ""}`}>
    <div className="flex items-start justify-between mb-3">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone === "warn" ? "bg-destructive/15" : "gradient-ink"}`}>
        <Icon className={`h-5 w-5 ${tone === "warn" ? "text-destructive" : "text-primary-foreground"}`} />
      </div>
    </div>
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold mt-1">{value}</p>
    {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
  </Card>
);

export default Dashboard;
