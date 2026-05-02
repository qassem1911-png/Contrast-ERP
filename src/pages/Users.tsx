import { useEffect, useState } from "react";
import { DashboardLayout } from "../components/DashboardLayout";
import { supabase } from "../integrations/supabase/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "../components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Switch } from "../components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "sonner";
import { 
  ShieldCheck, UserPlus, Settings2, Users as UsersIcon, Wrench, Activity, 
  Loader2, Mail, Phone, Key, Ban, MoreVertical, Boxes, FileText
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { AppRole, ROLE_LABELS_AR, ROLE_BADGE_VARIANTS } from "../lib/roles";

interface UserRow {
  id: string;
  arabic_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  roles: AppRole[];
}

const ROLE_OPTIONS: AppRole[] = ["super_admin", "admin", "storekeeper", "technician"];

const Users = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rolePermissions, setRolePermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [adminInfoOpen, setAdminInfoOpen] = useState(false);

  // Password Reset state
  const [resetOpen, setResetOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPass, setNewPass] = useState("");
  const [resetting, setResetting] = useState(false);

  // Create form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [arabicName, setArabicName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<AppRole>("technician");

  // System Settings
  const [performanceEnabled, setPerformanceEnabled] = useState(true);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const loadSettings = async () => {
    const { data } = await supabase.from("system_settings").select("*").eq("setting_key", "show_tech_performance").maybeSingle();
    if (data) {
      setPerformanceEnabled(data.is_enabled);
      setSettingsId(data.id);
    }
  };

  const togglePerformance = async (val: boolean) => {
    setPerformanceEnabled(val);
    const payload: any = { 
      setting_key: "show_tech_performance", 
      is_enabled: val,
      updated_at: new Date().toISOString()
    };
    if (settingsId) payload.id = settingsId;

    const { error } = await supabase.from("system_settings").upsert(payload, { onConflict: 'setting_key' });
    
    if (error) {
      toast.error("فشل تحديث الإعدادات: " + error.message);
      setPerformanceEnabled(!val);
    } else {
      toast.success("تم تحديث إعدادات النظام بنجاح");
      loadSettings();
    }
  };

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: rolesData }, { data: permData }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("role_permissions").select("*")
    ]);
    const rolesMap = new Map<string, AppRole[]>();
    (rolesData ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    setUsers((profiles ?? []).map((p: any) => ({
      ...p, roles: rolesMap.get(p.id) ?? [],
    })));
    setRolePermissions(permData ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); loadSettings(); }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(), password,
      options: { data: { arabic_name: arabicName.trim(), phone: phone.trim() || undefined } },
    });
    if (signUpErr || !signUpData.user) { setCreating(false); toast.error("فشل إنشاء الحساب: " + signUpErr?.message); return; }
    const { error: rpcErr } = await supabase.rpc("admin_create_user", {
      _user_id: signUpData.user.id, _email: email.trim(), _arabic_name: arabicName.trim(), _role: role, _phone: phone.trim() || undefined,
    });
    setCreating(false);
    if (rpcErr) { toast.error("فشل تعيين الدور: " + rpcErr.message); return; }
    toast.success("تم إنشاء المستخدم بنجاح");
    setOpen(false); load();
  };

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    setResetting(true);
    const { error } = await supabase.rpc("admin_reset_password", {
      _user_id: resetTarget.id, _new_password: newPass,
    });
    setResetting(false);
    if (error) { toast.error("فشل تغيير كلمة المرور: " + error.message); return; }
    toast.success("تم تغيير كلمة المرور بنجاح");
    setResetOpen(false); setNewPass("");
  };

  const updateRole = async (userId: string, currentRoles: AppRole[], newRole: AppRole) => {
    const { error } = await supabase.rpc("admin_update_user_role", {
      _user_id: userId, _new_role: newRole,
    });
    if (error) { toast.error("فشل تحديث الدور: " + error.message); return; }
    toast.success("تم تحديث الدور بنجاح");
    load();
  };

  const toggleStatus = async (user: UserRow) => {
    const { error } = await supabase.from("profiles").update({ is_active: !user.is_active }).eq("id", user.id);
    if (error) { toast.error("فشل تغيير حالة المستخدم: " + error.message); return; }
    toast.success("تم تغيير حالة المستخدم بنجاح");
    load();
  };

  const togglePermission = async (role: string, module: string, currentVal: boolean) => {
    const roleObj = rolePermissions.find(r => r.role === role);
    if (!roleObj) return;
    const newPerms = { ...roleObj.permissions, [module]: !currentVal };
    const { error } = await supabase.from("role_permissions").update({ permissions: newPerms }).eq("role", role);
    if (error) { toast.error("فشل التحديث: " + error.message); return; }
    toast.success("تم تحديث الصلاحيات بنجاح");
    load();
  };

  const MODULES = [
    { key: "inventory", label: "المخزون" },
    { key: "invoices", label: "الفواتير" },
    { key: "expenses", label: "المصاريف" },
    { key: "analytics", label: "التحليلات" },
    { key: "customers", label: "العملاء" },
    { key: "suppliers", label: "الموردين" },
    { key: "system", label: "إدارة النظام" }
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-2">
          <div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3 text-slate-900">
               <ShieldCheck className="h-10 w-10 text-primary" /> إدارة النظام
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">التحكم في صلاحيات المستخدمين وإعدادات المنصة المركزية</p>
          </div>
          <div className="flex gap-3">
             <Button onClick={() => setOpen(true)} className="h-12 px-6 shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all hover:scale-105 active:scale-95">
               <UserPlus className="h-5 w-5 ml-2" /> مستخدم جديد
             </Button>
             <Button variant="outline" onClick={() => setAdminInfoOpen(true)} className="h-12 px-6 shadow-sm font-bold border-2 rounded-xl">
               <Settings2 className="h-5 w-5 ml-2" /> مساعدة
             </Button>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
           <TabsList className="bg-slate-100/50 p-1 mb-6 flex-wrap h-auto mx-2">
             <TabsTrigger value="users" className="gap-2 px-6">المستخدمين</TabsTrigger>
             {isSuperAdmin && <TabsTrigger value="permissions" className="gap-2 px-6">مصفوفة الصلاحيات (Roles Matrix)</TabsTrigger>}
           </TabsList>

           <TabsContent value="users" className="space-y-6">
              <div className="grid md:grid-cols-4 gap-6 px-2">
           <Card className="p-6 border-none shadow-xl bg-gradient-to-br from-indigo-50/50 to-white overflow-hidden relative group">
              <div className="flex items-center gap-4 mb-2 relative z-10">
                 <div className="p-3 bg-indigo-500 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform"><UsersIcon className="h-6 w-6" /></div>
                 <div>
                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest">إجمالي المستخدمين</p>
                    <p className="text-3xl font-black text-indigo-900">{users.length}</p>
                 </div>
              </div>
              <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-indigo-500/5 rounded-full blur-2xl" />
           </Card>
           
           <Card className="p-6 border-none shadow-xl bg-gradient-to-br from-emerald-50/50 to-white overflow-hidden relative group">
              <div className="flex items-center gap-4 mb-2 relative z-10">
                 <div className="p-3 bg-emerald-500 rounded-xl text-white shadow-lg group-hover:scale-110 transition-transform"><Wrench className="h-6 w-6" /></div>
                 <div>
                    <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">الفنيين النشطين</p>
                    <p className="text-3xl font-black text-emerald-900">{users.filter(u => u.roles.includes('technician')).length}</p>
                 </div>
              </div>
              <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-emerald-500/5 rounded-full blur-2xl" />
           </Card>

           <Card className="md:col-span-2 p-6 border-none shadow-xl bg-white border-r-4 border-amber-500">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500 rounded-xl text-white shadow-lg"><Activity className="h-6 w-6" /></div>
                    <div>
                       <p className="text-sm text-slate-900 font-black">عرض أداء الفنيين في الرئيسية</p>
                       <p className="text-xs text-muted-foreground mt-0.5">تفعيل ظهور التقارير البيانية والإحصائية للجميع</p>
                    </div>
                 </div>
                 <Switch checked={performanceEnabled} onCheckedChange={togglePerformance} className="data-[state=checked]:bg-amber-500" />
              </div>
           </Card>
        </div>

        <Card className="overflow-hidden border-none shadow-2xl mx-2 rounded-2xl bg-white/80 backdrop-blur-sm">
          {loading ? (
            <div className="p-20 flex justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-right font-black py-6 pr-8 text-slate-600">المستخدم</TableHead>
                    <TableHead className="text-right font-black py-6 text-slate-600">الدور الوظيفي</TableHead>
                    <TableHead className="text-right font-black py-6 text-slate-600">بيانات التواصل</TableHead>
                    <TableHead className="text-center font-black py-6 text-slate-600">الحالة</TableHead>
                    <TableHead className="text-center font-black py-6 pl-8 text-slate-600">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-slate-50/80 transition-colors group border-b border-slate-50 last:border-0">
                      <TableCell className="py-6 pr-8">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-4 border-white shadow-lg ring-1 ring-slate-100">
                            <AvatarImage src={u.avatar_url || ""} />
                            <AvatarFallback className="bg-slate-100 text-slate-700 font-bold text-lg">{u.arabic_name?.charAt(0) || u.email?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                             <span className="font-black text-slate-900">{u.arabic_name}</span>
                             <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{u.id}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex flex-wrap gap-1.5">
                          {u.roles.map((r) => (
                            <Badge key={r} variant={ROLE_BADGE_VARIANTS[r]} className="font-bold px-3 py-1 rounded-lg border-none shadow-sm text-[11px]">
                              {ROLE_LABELS_AR[r]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="py-6">
                        <div className="flex flex-col gap-1.5">
                           <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100/50 w-fit px-2 py-1 rounded-md border border-slate-100">
                             <Mail className="h-3 w-3 text-slate-400" /> {u.email}
                           </div>
                           {u.phone && (
                             <div className="flex items-center gap-2 text-xs font-bold text-slate-500 px-2 py-1">
                               <Phone className="h-3 w-3 text-slate-400" /> {u.phone}
                             </div>
                           )}
                        </div>
                      </TableCell>
                      <TableCell className="py-6 text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => isSuperAdmin && toggleStatus(u)}
                          className="flex items-center justify-center gap-2"
                        >
                           <div className={`h-2.5 w-2.5 rounded-full ring-4 ring-offset-2 ${u.is_active ? 'bg-emerald-500 ring-emerald-500/10' : 'bg-slate-300 ring-slate-300/10'}`} />
                           <span className={`text-xs font-bold ${u.is_active ? 'text-emerald-700' : 'text-slate-500'}`}>
                             {u.is_active ? 'نشط' : 'معطل'}
                           </span>
                        </Button>
                      </TableCell>
                      <TableCell className="py-6 text-center pl-8">
                        <div className="flex justify-center gap-2">
                          {isSuperAdmin && currentUser?.id !== u.id && (
                            <Select 
                              value={u.roles[0] || ""} 
                              onValueChange={(val) => updateRole(u.id, u.roles, val as AppRole)}
                            >
                              <SelectTrigger className="h-8 text-xs border-dashed w-[110px]">
                                <SelectValue placeholder="تغيير الدور" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map(opt => (
                                  <SelectItem key={opt} value={opt} className="text-xs">{ROLE_LABELS_AR[opt]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-all" 
                            onClick={() => { setResetTarget(u); setResetOpen(true); }}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="permissions" className="mx-2">
            <Card className="overflow-hidden border-none shadow-2xl rounded-2xl bg-white/80 backdrop-blur-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="border-b border-slate-100">
                      <TableHead className="text-right font-black py-6 pr-8 text-slate-600">الصفحة / الوحدة</TableHead>
                      {ROLE_OPTIONS.map(role => (
                        <TableHead key={role} className="text-center font-black py-6 text-slate-600">
                          {ROLE_LABELS_AR[role]}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULES.map(mod => (
                      <TableRow key={mod.key} className="hover:bg-slate-50/80 transition-colors border-b border-slate-50">
                        <TableCell className="py-6 pr-8 font-bold text-slate-900">{mod.label}</TableCell>
                        {ROLE_OPTIONS.map(role => {
                          const rp = rolePermissions.find(r => r.role === role);
                          const hasPerm = rp?.permissions?.[mod.key] ?? false;
                          return (
                            <TableCell key={`${role}-${mod.key}`} className="py-6 text-center">
                              <Switch 
                                checked={hasPerm} 
                                onCheckedChange={() => togglePermission(role, mod.key, hasPerm)}
                                disabled={role === 'super_admin'}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
      </div>

      {/* New User Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="text-right sm:max-w-xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <div className="bg-primary p-8 text-primary-foreground relative overflow-hidden">
             <div className="relative z-10">
                <DialogTitle className="text-3xl font-black mb-2">إضافة مستخدم جديد</DialogTitle>
                <DialogDescription className="text-primary-foreground/70 text-lg">أدخل بيانات العضو الجديد لتمنحه صلاحيات الوصول للنظام</DialogDescription>
             </div>
             <UserPlus className="absolute -bottom-6 -right-6 h-32 w-32 opacity-10 rotate-12" />
          </div>
          <form onSubmit={onCreate} className="p-8 space-y-6 bg-white">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">الاسم الكامل باللغة العربية *</Label>
                <Input value={arabicName} onChange={e => setArabicName(e.target.value)} placeholder="مثال: قاسم محمد" className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all" required />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">رقم الهاتف</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="010..." className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">البريد الإلكتروني *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@kentroast.com" className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all" required />
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-slate-700">كلمة المرور الأولية *</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white transition-all" required />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-bold text-slate-700">الدور الوظيفي / الصلاحيات *</Label>
                <Select value={role} onValueChange={v => setRole(v as AppRole)}>
                   <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100">
                      <SelectValue placeholder="اختر الدور" />
                   </SelectTrigger>
                   <SelectContent>
                      {ROLE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt} className="font-bold py-3">{ROLE_LABELS_AR[opt]}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-3 mt-8">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-12 flex-1 font-bold rounded-xl">إلغاء</Button>
              <Button type="submit" disabled={creating} className="h-12 flex-[2] font-black rounded-xl text-lg shadow-lg">
                {creating ? <Loader2 className="h-5 w-5 animate-spin" /> : "إنشاء الحساب الآن"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent dir="rtl" className="text-right rounded-2xl border-none shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">تغيير كلمة المرور</DialogTitle>
            <DialogDescription>أنت بصدد تغيير كلمة المرور للمستخدم: <span className="font-bold text-slate-900">{resetTarget?.arabic_name}</span></DialogDescription>
          </DialogHeader>
          <form onSubmit={onResetPassword} className="space-y-6 pt-4">
             <div className="space-y-2">
                <Label className="font-bold">كلمة المرور الجديدة *</Label>
                <Input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="h-12 rounded-xl" required />
             </div>
             <DialogFooter className="gap-3">
                <Button type="button" variant="ghost" onClick={() => setResetOpen(false)} className="h-12 flex-1 rounded-xl">تراجع</Button>
                <Button type="submit" disabled={resetting} className="h-12 flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 font-bold">
                   {resetting ? <Loader2 className="h-5 w-5 animate-spin" /> : "تأكيد التغيير"}
                </Button>
             </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Guide Modal */}
      <Dialog open={adminInfoOpen} onOpenChange={setAdminInfoOpen}>
        <DialogContent dir="rtl" className="max-w-2xl text-right">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-primary">دليل سير العمل (Workflow Guide)</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-4 text-slate-700 leading-relaxed">
             <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border">
               <div className="p-2 bg-primary/10 rounded-lg text-primary"><Boxes className="h-5 w-5" /></div>
               <div>
                 <h3 className="font-bold text-lg mb-1">1. المخزون والموردين (Stock)</h3>
                 <p className="text-sm">يتم تسجيل المنتجات والطابعات في صفحة المخزون، وربط المشتريات بحساب المورد لتتبع الديون وتسديدها جزئياً أو كلياً.</p>
               </div>
             </div>
             <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border">
               <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600"><Wrench className="h-5 w-5" /></div>
               <div>
                 <h3 className="font-bold text-lg mb-1">2. العهد الفنية (Custody)</h3>
                 <p className="text-sm">يقوم أمين المخزن أو الإدارة بتسليم كميات محددة من المنتجات أو طابعات كاملة للفنيين. الفنيون يستخدمون "عهدتي" لاستهلاك القطع أو إرجاعها للمخزن.</p>
               </div>
             </div>
             <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border">
               <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600"><FileText className="h-5 w-5" /></div>
               <div>
                 <h3 className="font-bold text-lg mb-1">3. الفواتير والتحصيل (Invoices & Payments)</h3>
                 <p className="text-sm">الفني يمكنه إنشاء فواتير استناداً للأصناف المستهلكة أو المباعة للعملاء، ويتم تسجيل الدفعات المالية المرتبطة بالفاتورة بشكل ديناميكي (جزئي أو كلي).</p>
               </div>
             </div>
             <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border">
               <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600"><Activity className="h-5 w-5" /></div>
               <div>
                 <h3 className="font-bold text-lg mb-1">4. التحليلات وصلاحيات الإدارة (Management)</h3>
                 <p className="text-sm">كصاحب عمل، تتيح لك لوحة التحليلات مراقبة الأرباح الشهرية، وتتيح صفحة الإدارة التحكم الكامل بصلاحيات كل موظف وتعطيل الحسابات عند الحاجة.</p>
               </div>
             </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Users;
