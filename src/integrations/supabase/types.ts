export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          after_value: Json | null
          before_value: Json | null
          created_at: string
          id: string
          record_id: string | null
          table_name: string | null
          user_id: string | null
          user_role: string | null
          action: string | null
          entity: string | null
        }
        Insert: {
          action_type: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          user_role?: string | null
          action?: string | null
          entity?: string | null
        }
        Update: {
          action_type?: string
          after_value?: Json | null
          before_value?: Json | null
          created_at?: string
          id?: string
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
          user_role?: string | null
          action?: string | null
          entity?: string | null
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      custody_items: {
        Row: {
          assigned_quantity: number
          created_at: string
          id: string
          notes: string | null
          printer_id: string | null
          product_id: string | null
          session_id: string
          status: string
          used_quantity: number
        }
        Insert: {
          assigned_quantity?: number
          created_at?: string
          id?: string
          notes?: string | null
          printer_id?: string | null
          product_id?: string | null
          session_id: string
          status?: string
          used_quantity?: number
        }
        Update: {
          assigned_quantity?: number
          created_at?: string
          id?: string
          notes?: string | null
          printer_id?: string | null
          product_id?: string | null
          session_id?: string
          status?: string
          used_quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "custody_items_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_items_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custody_items_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "custody_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      custody_sessions: {
        Row: {
          closed_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          opened_at: string
          status: string
          technician_id: string
        }
        Insert: {
          closed_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          status?: string
          technician_id: string
        }
        Update: {
          closed_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          status?: string
          technician_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          created_at: string
          created_by: string
          id: string
          printer_id: string | null
          product_id: string | null
          quantity: number
          reason: string
          reference_id: string | null
          reference_type: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          printer_id?: string | null
          product_id?: string | null
          quantity: number
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          printer_id?: string | null
          product_id?: string | null
          quantity?: number
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          cost_price_snapshot: number
          created_at: string
          custody_item_id: string | null
          id: string
          invoice_id: string
          line_total: number
          price_at_sale: number
          printer_id: string | null
          product_id: string | null
          quantity: number
          selling_price_snapshot: number
        }
        Insert: {
          cost_price_snapshot?: number
          created_at?: string
          custody_item_id?: string | null
          id?: string
          invoice_id: string
          line_total: number
          price_at_sale: number
          printer_id?: string | null
          product_id?: string | null
          quantity: number
          selling_price_snapshot?: number
        }
        Update: {
          cost_price_snapshot?: number
          created_at?: string
          custody_item_id?: string | null
          id?: string
          invoice_id?: string
          line_total?: number
          price_at_sale?: number
          printer_id?: string | null
          product_id?: string | null
          quantity?: number
          selling_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          invoice_number: string
          notes: string | null
          payment_status: string
          remaining_amount: number
          session_id: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          technician_id: string
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          invoice_number: string
          notes?: string | null
          payment_status?: string
          remaining_amount?: number
          session_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          technician_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          payment_status?: string
          remaining_amount?: number
          session_id?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          technician_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "custody_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          recorded_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          brand_id: string
          cost_price: number
          counter: number
          created_at: string
          created_by: string | null
          id: string
          model_id: string
          notes: string | null
          serial_number: string
          status: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          cost_price?: number
          counter?: number
          created_at?: string
          created_by?: string | null
          id?: string
          model_id: string
          notes?: string | null
          serial_number: string
          status?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          cost_price?: number
          counter?: number
          created_at?: string
          created_by?: string | null
          id?: string
          model_id?: string
          notes?: string | null
          serial_number?: string
          status?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printers_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          category: string
          cost_price: number
          created_at: string
          created_by: string | null
          id: string
          low_stock_threshold: number
          model_id: string
          name: string
          notes: string | null
          quantity: number
          sku: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          brand_id: string
          category: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_threshold?: number
          model_id: string
          name: string
          notes?: string | null
          quantity?: number
          sku?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          brand_id?: string
          category?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          id?: string
          low_stock_threshold?: number
          model_id?: string
          name?: string
          notes?: string | null
          quantity?: number
          sku?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          arabic_name: string
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          arabic_name?: string
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          arabic_name?: string
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      spare_part_models: {
        Row: {
          created_at: string
          id: string
          model_id: string
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          model_id: string
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          model_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_models_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_models_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_models_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      printers_safe: {
        Row: {
          brand_id: string | null
          counter: number | null
          created_at: string | null
          id: string | null
          model_id: string | null
          notes: string | null
          serial_number: string | null
          status: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          counter?: number | null
          created_at?: string | null
          id?: string | null
          model_id?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          counter?: number | null
          created_at?: string | null
          id?: string | null
          model_id?: string | null
          notes?: string | null
          serial_number?: string | null
          status?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printers_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      products_safe: {
        Row: {
          brand_id: string | null
          category: string | null
          created_at: string | null
          id: string | null
          low_stock_threshold: number | null
          model_id: string | null
          name: string | null
          notes: string | null
          quantity: number | null
          sku: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          low_stock_threshold?: number | null
          model_id?: string | null
          name?: string | null
          notes?: string | null
          quantity?: number | null
          sku?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string | null
          low_stock_threshold?: number | null
          model_id?: string | null
          name?: string | null
          notes?: string | null
          quantity?: number | null
          sku?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      adjust_product_stock: {
        Args: {
          _delta: number
          _product_id: string
          _reason: string
          _type?: string
        }
        Returns: undefined
      }
      admin_create_user: {
        Args: {
          _arabic_name: string
          _email: string
          _phone?: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: string
      }
      assign_custody_printer: {
        Args: { _printer_id: string; _reason: string; _technician_id: string }
        Returns: string
      }
      assign_custody_product: {
        Args: {
          _product_id: string
          _quantity: number
          _reason: string
          _technician_id: string
        }
        Returns: string
      }
      audit_logs_readable: {
        Args: { _limit?: number }
        Returns: {
          action_label: string
          action_type: string
          created_at: string
          id: string
          record_id: string
          table_name: string
          user_id: string
          user_name: string
        }[]
      }
      create_invoice: {
        Args: {
          _amount_paid?: number
          _apply_vat?: boolean
          _customer_id: string
          _items: Json
          _notes?: string
        }
        Returns: string
      }
      custody_activity_24h: {
        Args: never
        Returns: {
          closed_at: string
          items_count: number
          opened_at: string
          session_id: string
          status: string
          technician_id: string
          technician_name: string
        }[]
      }
      damage_custody_item:
        | {
            Args: { _custody_item_id: string; _notes?: string }
            Returns: undefined
          }
        | {
            Args: {
              _custody_item_id: string
              _notes?: string
              _quantity?: number
            }
            Returns: undefined
          }
      dashboard_stats: {
        Args: never
        Returns: {
          active_custody_sessions: number
          invoices_today: number
          invoices_total: number
          revenue_today: number
        }[]
      }
      finance_summary: {
        Args: never
        Returns: {
          net_profit: number
          profit_today: number
          revenue_today: number
          total_cost: number
          total_invoices: number
          total_outstanding: number
          total_paid: number
          total_revenue: number
        }[]
      }
      get_printers_full: {
        Args: never
        Returns: {
          brand_id: string
          cost_price: number
          counter: number
          created_at: string
          id: string
          model_id: string
          notes: string
          serial_number: string
          status: string
          unit_price: number
          updated_at: string
        }[]
      }
      get_products_full: {
        Args: never
        Returns: {
          brand_id: string
          category: string
          cost_price: number
          created_at: string
          id: string
          low_stock_threshold: number
          model_id: string
          name: string
          notes: string
          quantity: number
          sku: string
          unit_price: number
          updated_at: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      low_stock_alerts: {
        Args: never
        Returns: {
          low_stock_threshold: number
          name: string
          product_id: string
          quantity: number
        }[]
      }
      my_custody: {
        Args: never
        Returns: {
          assigned_quantity: number
          brand_name: string
          custody_item_id: string
          item_name: string
          model_name: string
          notes: string
          printer_id: string
          product_id: string
          remaining_quantity: number
          session_id: string
          status: string
          unit_price: number
          used_quantity: number
        }[]
      }
      next_invoice_number: { Args: never; Returns: string }
      record_payment: {
        Args: {
          _amount: number
          _invoice_id: string
          _method?: string
          _notes?: string
        }
        Returns: undefined
      }
      return_custody_item:
        | {
            Args: { _custody_item_id: string; _notes?: string }
            Returns: undefined
          }
        | {
            Args: {
              _custody_item_id: string
              _notes?: string
              _quantity?: number
            }
            Returns: undefined
          }
      technician_performance: {
        Args: never
        Returns: {
          arabic_name: string
          invoice_count: number
          items_used: number
          technician_id: string
          total_revenue: number
        }[]
      }
      top_customers: {
        Args: { _limit?: number }
        Returns: {
          customer_id: string
          invoice_count: number
          name: string
          total_spent: number
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "storekeeper" | "technician"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "storekeeper", "technician"],
    },
  },
} as const
