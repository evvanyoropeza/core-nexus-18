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
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_primary: boolean
          mobile: string | null
          name: string
          phone: string | null
          position: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name: string
          phone?: string | null
          position?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          mobile?: string | null
          name?: string
          phone?: string | null
          position?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          customer_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          customer_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          credit_days: number
          credit_limit: number
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tags: string[]
          tax_id: string | null
          tenant_id: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number
          credit_limit?: number
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tags?: string[]
          tax_id?: string | null
          tenant_id: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number
          credit_limit?: number
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tags?: string[]
          tax_id?: string | null
          tenant_id?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          branding: Json
          currency: string
          folio_next: number
          folio_prefix: string
          order_folio_next: number
          order_folio_prefix: string
          payment_terms: string | null
          pdf_footer: string | null
          tax_rate: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          currency?: string
          folio_next?: number
          folio_prefix?: string
          order_folio_next?: number
          order_folio_prefix?: string
          payment_terms?: string | null
          pdf_footer?: string | null
          tax_rate?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          currency?: string
          folio_next?: number
          folio_prefix?: string
          order_folio_next?: number
          order_folio_prefix?: string
          payment_terms?: string | null
          pdf_footer?: string | null
          tax_rate?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_price_tiers: {
        Row: {
          created_at: string
          id: string
          min_quantity: number
          price: number
          product_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          min_quantity: number
          price: number
          product_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          min_quantity?: number
          price?: number
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_tiers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          list_price: number
          name: string
          notes: string | null
          sku: string
          stock_current: number
          stock_min: number
          tags: string[]
          tax_rate: number
          tenant_id: string
          type: Database["public"]["Enums"]["product_type"]
          unit: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          list_price?: number
          name: string
          notes?: string | null
          sku: string
          stock_current?: number
          stock_min?: number
          tags?: string[]
          tax_rate?: number
          tenant_id: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          list_price?: number
          name?: string
          notes?: string | null
          sku?: string
          stock_current?: number
          stock_min?: number
          tags?: string[]
          tax_rate?: number
          tenant_id?: string
          type?: Database["public"]["Enums"]["product_type"]
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_tenant_id: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_tenant_id?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_tenant_id?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_tenant_id_fkey"
            columns: ["current_tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_items: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          name: string
          position: number
          product_id: string | null
          quantity: number
          quotation_id: string
          sku: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          tenant_id: string
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name: string
          position?: number
          product_id?: string | null
          quantity?: number
          quotation_id: string
          sku?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id: string
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name?: string
          position?: number
          product_id?: string | null
          quantity?: number
          quotation_id?: string
          sku?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id?: string
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_public_tokens: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          last_viewed_at: string | null
          quotation_id: string
          revoked_at: string | null
          tenant_id: string
          token: string
          view_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          quotation_id: string
          revoked_at?: string | null
          tenant_id: string
          token: string
          view_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          last_viewed_at?: string | null
          quotation_id?: string
          revoked_at?: string | null
          tenant_id?: string
          token?: string
          view_count?: number
        }
        Relationships: []
      }
      quotation_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          quotation_id: string
          reason: string | null
          snapshot: Json
          tenant_id: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          quotation_id: string
          reason?: string | null
          snapshot?: Json
          tenant_id: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          quotation_id?: string
          reason?: string | null
          snapshot?: Json
          tenant_id?: string
          version_number?: number
        }
        Relationships: []
      }
      quotations: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          customer_snapshot: Json
          decided_at: string | null
          delivery_terms: string | null
          discount_amount: number
          discount_pct: number
          folio: string
          id: string
          internal_notes: string | null
          issue_date: string
          notes: string | null
          payment_terms: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          customer_snapshot?: Json
          decided_at?: string | null
          delivery_terms?: string | null
          discount_amount?: number
          discount_pct?: number
          folio: string
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          customer_snapshot?: Json
          decided_at?: string | null
          delivery_terms?: string | null
          discount_amount?: number
          discount_pct?: number
          folio?: string
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      sales_order_items: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          name: string
          order_id: string
          position: number
          product_id: string | null
          quantity: number
          quantity_fulfilled: number
          sku: string | null
          subtotal: number
          tax_amount: number
          tax_rate: number
          tenant_id: string
          total: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name: string
          order_id: string
          position?: number
          product_id?: string | null
          quantity?: number
          quantity_fulfilled?: number
          sku?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id: string
          total?: number
          unit?: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name?: string
          order_id?: string
          position?: number
          product_id?: string | null
          quantity?: number
          quantity_fulfilled?: number
          sku?: string | null
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          tenant_id?: string
          total?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string
          customer_snapshot: Json
          delivery_terms: string | null
          discount_amount: number
          discount_pct: number
          expected_delivery_date: string | null
          folio: string
          fulfilled_at: string | null
          id: string
          internal_notes: string | null
          issue_date: string
          notes: string | null
          payment_terms: string | null
          quotation_id: string | null
          status: Database["public"]["Enums"]["sales_order_status"]
          subtotal: number
          tax_amount: number
          tenant_id: string
          total: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id: string
          customer_snapshot?: Json
          delivery_terms?: string | null
          discount_amount?: number
          discount_pct?: number
          expected_delivery_date?: string | null
          folio: string
          fulfilled_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string
          customer_snapshot?: Json
          delivery_terms?: string | null
          discount_amount?: number
          discount_pct?: number
          expected_delivery_date?: string | null
          folio?: string
          fulfilled_at?: string | null
          id?: string
          internal_notes?: string | null
          issue_date?: string
          notes?: string | null
          payment_terms?: string | null
          quotation_id?: string | null
          status?: Database["public"]["Enums"]["sales_order_status"]
          subtotal?: number
          tax_amount?: number
          tenant_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          currency: string
          fiscal_country: string | null
          fiscal_id: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          primary_color: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          fiscal_country?: string | null
          fiscal_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          fiscal_country?: string | null
          fiscal_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_tenants: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tenants_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_quotation_to_order: {
        Args: { _quotation_id: string }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      duplicate_quotation: { Args: { _quotation_id: string }; Returns: string }
      generate_order_folio: { Args: { _tenant_id: string }; Returns: string }
      generate_quotation_folio: {
        Args: { _tenant_id: string }
        Returns: string
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_member_of: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      recalc_order_totals: { Args: { _order_id: string }; Returns: undefined }
      recalc_quotation_totals: {
        Args: { _quotation_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      snapshot_quotation_version: {
        Args: { _quotation_id: string; _reason?: string }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "superadmin"
        | "admin"
        | "sales"
        | "operations"
        | "finance"
        | "viewer"
      product_type: "product" | "service"
      quotation_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "expired"
        | "converted"
      sales_order_status:
        | "draft"
        | "confirmed"
        | "in_progress"
        | "fulfilled"
        | "cancelled"
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
      app_role: [
        "superadmin",
        "admin",
        "sales",
        "operations",
        "finance",
        "viewer",
      ],
      product_type: ["product", "service"],
      quotation_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "expired",
        "converted",
      ],
      sales_order_status: [
        "draft",
        "confirmed",
        "in_progress",
        "fulfilled",
        "cancelled",
      ],
    },
  },
} as const
