import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card } from "../components/ui/card";
import { Logo } from "../components/Logo";
import { supabase } from "../integrations/supabase/client";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error("فشل تسجيل الدخول", { description: error.message });
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen gradient-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Logo size="lg" />
          <p className="text-muted-foreground mt-3 text-center">نظام إدارة المخزون والصيانة</p>
        </div>

        <Card className="p-8 shadow-elegant border-border/60">
          <h1 className="text-2xl font-bold mb-1">مرحبًا بعودتك</h1>
          <p className="text-muted-foreground text-sm mb-6">سجّل دخولك للوصول إلى لوحة التحكم</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@contrast.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                dir="ltr"
                className="text-right"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border/60 text-center text-sm text-muted-foreground">
            <Link to="/" className="block hover:text-foreground transition-smooth">
              ← العودة للصفحة الرئيسية
            </Link>
            <p className="mt-3 text-xs">
              الحسابات تُنشأ من قبل المسؤول فقط. تواصل مع المسؤول للحصول على حساب.
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} شركة كونتراست
        </p>
      </div>
    </div>
  );
};

export default Login;
