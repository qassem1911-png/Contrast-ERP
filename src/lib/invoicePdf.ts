import { supabase } from "../integrations/supabase/client";

interface InvoiceLine {
  name: string;
  quantity: number;
  price_at_sale: number;
  line_total: number;
}
interface InvoiceFull {
  invoice_number: string;
  created_at: string;
  total: number;
  amount_paid: number;
  remaining_amount: number;
  payment_status: string;
  notes: string | null;
  customer_name: string;
  technician_name: string;
  items: InvoiceLine[];
}

const STATUS_AR: Record<string, string> = {
  paid: "مدفوعة", partial: "جزئية", unpaid: "غير مدفوعة",
};

async function fetchInvoiceFull(invoiceId: string): Promise<InvoiceFull | null> {
  const { data: inv } = await supabase
    .from("invoices")
    .select("*, customers(name)")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!inv) return null;

  const { data: items } = await supabase
    .from("invoice_items")
    .select("quantity, price_at_sale, line_total, products(name), printers(serial_number)")
    .eq("invoice_id", invoiceId);

  const { data: prof } = await supabase
    .from("profiles").select("arabic_name").eq("id", inv.technician_id).maybeSingle();
  const techName = prof?.arabic_name || "—";

  return {
    invoice_number: inv.invoice_number,
    created_at: inv.created_at,
    total: Number(inv.total),
    amount_paid: Number(inv.amount_paid),
    remaining_amount: Number(inv.remaining_amount),
    payment_status: inv.payment_status,
    notes: inv.notes,
    customer_name: (inv as { customers?: { name?: string } | null }).customers?.name ?? "—",
    technician_name: techName,
    items: (items ?? []).map((it: {
      quantity: number; price_at_sale: number; line_total: number;
      products?: { name?: string } | null; printers?: { serial_number?: string } | null;
    }) => ({
      name: it.products?.name || (it.printers?.serial_number ? `طابعة ${it.printers.serial_number}` : "—"),
      quantity: it.quantity,
      price_at_sale: Number(it.price_at_sale),
      line_total: Number(it.line_total),
    })),
  };
}

/** Opens a print window with a fully-RTL Arabic-shaped invoice. The user
 * picks "Save as PDF" in the print dialog — this produces a perfect Arabic
 * PDF since shaping is done by the OS/browser. */
export async function downloadInvoicePdf(invoiceId: string) {
  const inv = await fetchInvoiceFull(invoiceId);
  if (!inv) {
    alert("تعذّر تحميل بيانات الفاتورة");
    return;
  }

  const win = window.open("", "_blank", "width=900,height=1100");
  if (!win) {
    alert("الرجاء السماح بالنوافذ المنبثقة لتنزيل PDF");
    return;
  }

  const rows = inv.items.map(
    (it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(it.name)}</td>
      <td>${it.quantity}</td>
      <td>${it.price_at_sale.toLocaleString("ar-EG")}</td>
      <td>${it.line_total.toLocaleString("ar-EG")}</td>
    </tr>`,
  ).join("");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>فاتورة ${escapeHtml(inv.invoice_number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet" />
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; padding: 32px; color: #111; background: #fff; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: #666; font-size: 12px; }
  .row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; align-items: flex-start; }
  .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; min-width: 200px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: start; }
  th { background: #f6f6f6; font-weight: 700; }
  tfoot td { font-weight: 700; background: #fafafa; }
  .totals { margin-top: 16px; width: 320px; margin-inline-start: auto; font-size: 14px; }
  .totals .line { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dashed #ddd; }
  .totals .grand { font-weight: 700; font-size: 16px; border-bottom: none; padding-top: 10px; }
  .badge { display:inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .b-paid { background:#dcfce7; color:#166534; }
  .b-partial { background:#fef3c7; color:#92400e; }
  .b-unpaid { background:#fee2e2; color:#991b1b; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
</style>
</head>
<body>
  <div class="row">
    <div>
      <h1>فاتورة صيانة</h1>
      <div class="muted">رقم الفاتورة: <b>${escapeHtml(inv.invoice_number)}</b></div>
      <div class="muted">التاريخ: ${new Date(inv.created_at).toLocaleString("ar-EG")}</div>
    </div>
    <div class="card">
      <div class="muted">الحالة</div>
      <div><span class="badge ${badgeClass(inv.payment_status)}">${STATUS_AR[inv.payment_status] || inv.payment_status}</span></div>
    </div>
  </div>

  <div class="row">
    <div class="card" style="flex:1">
      <div class="muted">العميل</div>
      <div style="font-weight:700; margin-top:4px">${escapeHtml(inv.customer_name)}</div>
    </div>
    <div class="card" style="flex:1">
      <div class="muted">الفني</div>
      <div style="font-weight:700; margin-top:4px">${escapeHtml(inv.technician_name)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>الصنف</th>
        <th style="width:70px">الكمية</th>
        <th style="width:110px">سعر الوحدة</th>
        <th style="width:110px">الإجمالي</th>
      </tr>
    </thead>
    <tbody>${rows || `<tr><td colspan="5" style="text-align:center; color:#999">لا توجد بنود</td></tr>`}</tbody>
  </table>

  <div class="totals">
    <div class="line"><span>الإجمالي</span><span>${inv.total.toLocaleString("ar-EG")}</span></div>
    <div class="line"><span>المدفوع</span><span>${inv.amount_paid.toLocaleString("ar-EG")}</span></div>
    <div class="line grand"><span>المتبقي</span><span>${inv.remaining_amount.toLocaleString("ar-EG")}</span></div>
  </div>

  ${inv.notes ? `<div style="margin-top:24px"><div class="muted">ملاحظات</div><div>${escapeHtml(inv.notes)}</div></div>` : ""}

  <div class="no-print" style="margin-top:32px; text-align:center">
    <button onclick="window.print()" style="font-family:inherit; font-size:14px; padding:10px 24px; border-radius:8px; border:none; background:#111; color:#fff; cursor:pointer">
      طباعة / حفظ PDF
    </button>
  </div>
  <script>
    // Auto-open print dialog once fonts are ready so the user can "Save as PDF"
    window.addEventListener('load', () => {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => setTimeout(() => window.print(), 200));
      } else {
        setTimeout(() => window.print(), 400);
      }
    });
  </script>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

function badgeClass(s: string) {
  if (s === "paid") return "b-paid";
  if (s === "partial") return "b-partial";
  return "b-unpaid";
}
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}
