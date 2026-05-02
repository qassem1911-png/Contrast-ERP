import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ACTION_LABELS_AR } from "../lib/activity-logs";
import { Loader2, History } from "lucide-react";
import { Badge } from "./ui/badge";

interface Props {
  tableName: string;
  recordId?: string;
}

export const ActivityLogTab = ({ tableName, recordId }: Props) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs_with_users")
      .select("*")
      .eq("table_name", tableName)
      .order("created_at", { ascending: false });
    
    if (recordId) {
      query = query.eq("record_id", recordId);
    }

    const { data } = await query.limit(50);
    setLogs(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tableName, recordId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-bold">سجل الحركات</h3>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">لا توجد حركات مسجلة لهذا القسم</div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">المستخدم</TableHead>
                <TableHead className="text-right">نوع الحركة</TableHead>
                <TableHead className="text-right">التفاصيل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="text-xs sm:text-sm">
                  <TableCell className="text-right text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('ar-EG')}
                  </TableCell>
                  <TableCell className="text-right font-bold">{log.user_name || 'نظام'}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className="bg-primary/5">
                      {ACTION_LABELS_AR[log.action_type] || log.action_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs max-w-xs truncate">
                    {log.action || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
