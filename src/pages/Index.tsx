import { Button } from "../components/ui/button";
import { Logo } from "../components/Logo";
import { Card } from "../components/ui/card";
import { Boxes, Users, FileText, Shield, Wrench, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

const features = [
  { icon: Boxes, title: "إدارة المخزون", desc: "تتبع الطابعات وقطع الغيار والأحبار بأرقام تسلسلية فردية." },
  { icon: Users, title: "عهدة الفنيين", desc: "تسليم وتسلم العهد مع منع الإغلاق قبل تسوية الكميات." },
  { icon: FileText, title: "الفواتير الذكية", desc: "فواتير بيع وصيانة مع تجميد سعر اللحظة وتسجيل التعديلات." },
  { icon: Wrench, title: "دورة حياة الطابعة", desc: "سجل كامل لكل رقم تسلسلي من المخزن حتى العميل." },
  { icon: BarChart3, title: "تحليلات الإدارة", desc: "أرباح، مبيعات، مخزون منخفض، وتنبيهات لحظية." },
  { icon: Shield, title: "صلاحيات صارمة", desc: "أدمن، أمين مخزن، فني — كل دور يرى ما يخصه فقط." },
];

const Index = () => {
  return (
    <div className="min-h-screen gradient-surface">
      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between py-4">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost">
              <Link to="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild>
              <Link to="/login">دخول النظام</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container py-20 md:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary text-sm font-medium mb-6">
            <span className="h-2 w-2 rounded-full bg-accent" />
            نظام ERP متكامل لشركات الطابعات
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
            إدارة كاملة لمخزون كونتراست من نقطة واحدة
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            تتبع كل طابعة برقمها التسلسلي، أدر عهدة الفنيين، أصدر الفواتير،
            واطّلع على الأرباح اللحظية — كل ذلك بصلاحيات آمنة وواجهة عربية أنيقة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="text-base">
              <Link to="/login">ابدأ الآن</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base">
              <Link to="/login">عرض توضيحي</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container pb-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, desc }) => (
            <Card
              key={title}
              className="p-6 shadow-soft hover:shadow-elegant transition-smooth border-border/60"
            >
              <div className="h-12 w-12 rounded-xl gradient-ink flex items-center justify-center mb-4">
                <Icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">{title}</h3>
              <p className="text-muted-foreground leading-relaxed">{desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
          </div>
          <p>© {new Date().getFullYear()} شركة كونتراست — جميع الحقوق محفوظة</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
