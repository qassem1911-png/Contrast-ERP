import { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { Label } from "./ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";

export type ModelType = "printer" | "spare_part" | "ink";

interface Brand { id: string; name: string }
interface Model { id: string; name: string; brand_id: string; type: ModelType }

interface Props {
  type: ModelType;
  brandId: string;
  modelId: string;
  onBrandChange: (id: string) => void;
  onModelChange: (id: string) => void;
  required?: boolean;
}

export const BrandModelSelect = ({
  type, brandId, modelId, onBrandChange, onModelChange, required,
}: Props) => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [models, setModels] = useState<Model[]>([]);

  const loadBrands = () => {
    supabase.from("brands").select("id,name").order("name").then(({ data }) => {
      setBrands((data ?? []) as Brand[]);
    });
  };

  const loadModels = () => {
    if (!brandId) { setModels([]); return; }
    supabase
      .from("models")
      .select("id,name,brand_id,type")
      .eq("brand_id", brandId)
      .order("name")
      .then(({ data }) => setModels((data ?? []) as Model[]));
  };

  useEffect(() => {
    loadBrands();
    const sub = supabase.channel('brands-val').on('postgres_changes', { event: '*', schema: 'public', table: 'brands' }, loadBrands).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    loadModels();
    const sub = supabase.channel('models-val').on('postgres_changes', { event: '*', schema: 'public', table: 'models' }, loadModels).subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [brandId, type]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-2">
        <Label>العلامة التجارية{required && " *"}</Label>
        <Select
          value={brandId}
          onValueChange={(v) => { onBrandChange(v); onModelChange(""); }}
        >
          <SelectTrigger><SelectValue placeholder="اختر العلامة" /></SelectTrigger>
          <SelectContent>
            {brands.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">لا توجد علامات — أضِفها من صفحة الماركات</div>
            )}
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>الموديل{required && " *"}</Label>
        <Select
          value={modelId}
          onValueChange={onModelChange}
          disabled={!brandId}
        >
          <SelectTrigger>
            <SelectValue placeholder={brandId ? "اختر الموديل" : "اختر العلامة أولاً"} />
          </SelectTrigger>
          <SelectContent>
            {brandId && models.length === 0 && (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">لا موديلات لهذه العلامة</div>
            )}
            {models.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
