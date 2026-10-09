/**
 * Gerado a partir do schema real do projeto Supabase (mrpojncrgqnfieahgfbq).
 * NÃO edite à mão. Para regenerar depois de uma migration:
 *
 *   npx supabase gen types typescript --project-id mrpojncrgqnfieahgfbq  *     --schema public > src/lib/supabase/database.types.ts
 *
 * (e recoloque o bloco de atalhos no fim do arquivo)
 */

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          metadata?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      brokers: {
        Row: {
          applied_at: string
          bio: string | null
          created_at: string
          creci: string | null
          decided_at: string | null
          decided_by: string | null
          phone: string | null
          status: Database["public"]["Enums"]["broker_status"]
          user_id: string
        }
        Insert: {
          applied_at?: string
          bio?: string | null
          created_at?: string
          creci?: string | null
          decided_at?: string | null
          decided_by?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["broker_status"]
          user_id: string
        }
        Update: {
          applied_at?: string
          bio?: string | null
          created_at?: string
          creci?: string | null
          decided_at?: string | null
          decided_by?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["broker_status"]
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          cpf_cnpj: string | null
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      owner_profiles: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          status: Database["public"]["Enums"]["owner_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          status?: Database["public"]["Enums"]["owner_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          status?: Database["public"]["Enums"]["owner_status"]
          user_id?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          amenities: string[]
          approx_lat: number | null
          approx_lng: number | null
          bathrooms: number
          bedrooms: number
          built_area: number | null
          city: string
          code: string
          condition: Database["public"]["Enums"]["property_condition"]
          condo_fee: number | null
          created_at: string
          description: string
          features: string[]
          id: string
          in_condominium: boolean
          land_area: number | null
          landmarks: string
          location_precision: Database["public"]["Enums"]["location_precision"]
          neighborhood: string
          parking_spaces: number
          published_at: string | null
          purpose: Database["public"]["Enums"]["property_purpose"]
          rejection_reason: string | null
          rent_band: Database["public"]["Enums"]["rent_band"] | null
          sale_band: Database["public"]["Enums"]["sale_band"] | null
          state: string
          status: Database["public"]["Enums"]["property_status"]
          suites: number
          title: string
          total_area: number | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at: string
          views_count: number
        }
        Insert: {
          amenities?: string[]
          approx_lat?: number | null
          approx_lng?: number | null
          bathrooms?: number
          bedrooms?: number
          built_area?: number | null
          city?: string
          code?: string
          condition?: Database["public"]["Enums"]["property_condition"]
          condo_fee?: number | null
          created_at?: string
          description?: string
          features?: string[]
          id?: string
          in_condominium?: boolean
          land_area?: number | null
          landmarks?: string
          location_precision?: Database["public"]["Enums"]["location_precision"]
          neighborhood?: string
          parking_spaces?: number
          published_at?: string | null
          purpose: Database["public"]["Enums"]["property_purpose"]
          rejection_reason?: string | null
          rent_band?: Database["public"]["Enums"]["rent_band"] | null
          sale_band?: Database["public"]["Enums"]["sale_band"] | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number
          title?: string
          total_area?: number | null
          type: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          views_count?: number
        }
        Update: {
          amenities?: string[]
          approx_lat?: number | null
          approx_lng?: number | null
          bathrooms?: number
          bedrooms?: number
          built_area?: number | null
          city?: string
          code?: string
          condition?: Database["public"]["Enums"]["property_condition"]
          condo_fee?: number | null
          created_at?: string
          description?: string
          features?: string[]
          id?: string
          in_condominium?: boolean
          land_area?: number | null
          landmarks?: string
          location_precision?: Database["public"]["Enums"]["location_precision"]
          neighborhood?: string
          parking_spaces?: number
          published_at?: string | null
          purpose?: Database["public"]["Enums"]["property_purpose"]
          rejection_reason?: string | null
          rent_band?: Database["public"]["Enums"]["rent_band"] | null
          sale_band?: Database["public"]["Enums"]["sale_band"] | null
          state?: string
          status?: Database["public"]["Enums"]["property_status"]
          suites?: number
          title?: string
          total_area?: number | null
          type?: Database["public"]["Enums"]["property_type"]
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      property_documents: {
        Row: {
          created_at: string
          id: string
          label: string
          property_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          property_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          property_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media: {
        Row: {
          created_at: string
          id: string
          is_cover: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          position: number
          property_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_cover?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          position?: number
          property_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          is_cover?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          position?: number
          property_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_media_originals: {
        Row: {
          created_at: string
          media_id: string
          property_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          media_id: string
          property_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          media_id?: string
          property_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_media_originals_media_id_property_id_fkey"
            columns: ["media_id", "property_id"]
            isOneToOne: false
            referencedRelation: "property_media"
            referencedColumns: ["id", "property_id"]
          },
          {
            foreignKeyName: "property_media_originals_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_private: {
        Row: {
          accepts_financing: boolean
          accepts_trade: boolean
          address: string
          cep: string
          commercial_conditions: string
          commission_pct: number | null
          complement: string
          created_at: string
          down_payment: number | null
          exact_lat: number | null
          exact_lng: number | null
          geo_seed: number
          internal_notes: string
          min_price: number | null
          owner_id: string
          price_rent: number | null
          price_sale: number | null
          property_id: string
          street_number: string
          updated_at: string
        }
        Insert: {
          accepts_financing?: boolean
          accepts_trade?: boolean
          address?: string
          cep?: string
          commercial_conditions?: string
          commission_pct?: number | null
          complement?: string
          created_at?: string
          down_payment?: number | null
          exact_lat?: number | null
          exact_lng?: number | null
          geo_seed?: number
          internal_notes?: string
          min_price?: number | null
          owner_id: string
          price_rent?: number | null
          price_sale?: number | null
          property_id: string
          street_number?: string
          updated_at?: string
        }
        Update: {
          accepts_financing?: boolean
          accepts_trade?: boolean
          address?: string
          cep?: string
          commercial_conditions?: string
          commission_pct?: number | null
          complement?: string
          created_at?: string
          down_payment?: number | null
          exact_lat?: number | null
          exact_lng?: number | null
          geo_seed?: number
          internal_notes?: string
          min_price?: number | null
          owner_id?: string
          price_rent?: number | null
          price_sale?: number | null
          property_id?: string
          street_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_private_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          demand_budget_edits_per_day: number
          id: boolean
          master_email: string
          master_whatsapp: string
          match_budget_tolerance_pct: number
          updated_at: string
        }
        Insert: {
          demand_budget_edits_per_day?: number
          id?: boolean
          master_email?: string
          master_whatsapp?: string
          match_budget_tolerance_pct?: number
          updated_at?: string
        }
        Update: {
          demand_budget_edits_per_day?: number
          id?: boolean
          master_email?: string
          master_whatsapp?: string
          match_budget_tolerance_pct?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_as_owner: {
        Args: {
          _cpf_cnpj?: string
          _full_name: string
          _phone: string
          _whatsapp?: string
        }
        Returns: Database["public"]["Enums"]["owner_status"]
      }
      create_property: {
        Args: {
          _purpose: Database["public"]["Enums"]["property_purpose"]
          _title?: string
          _type: Database["public"]["Enums"]["property_type"]
        }
        Returns: string
      }
      delete_property: { Args: { _property: string }; Returns: undefined }
      is_active_broker: { Args: never; Returns: boolean }
      is_master: { Args: never; Returns: boolean }
      master_owners: {
        Args: {
          _status?: Database["public"]["Enums"]["owner_status"]
          _user?: string
        }
        Returns: {
          applied_at: string
          cpf_cnpj: string
          decided_at: string
          email: string
          full_name: string
          phone: string
          properties_count: number
          status: Database["public"]["Enums"]["owner_status"]
          user_id: string
          user_status: Database["public"]["Enums"]["user_status"]
          whatsapp: string
        }[]
      }
      my_roles: {
        Args: never
        Returns: {
          broker_status: Database["public"]["Enums"]["broker_status"]
          is_broker: boolean
          is_master: boolean
          is_owner: boolean
          owner_status: Database["public"]["Enums"]["owner_status"]
        }[]
      }
      register_property_view: {
        Args: { _property: string }
        Returns: undefined
      }
      set_broker_status: {
        Args: {
          _status: Database["public"]["Enums"]["broker_status"]
          _user: string
        }
        Returns: undefined
      }
      set_owner_status: {
        Args: {
          _status: Database["public"]["Enums"]["owner_status"]
          _user: string
        }
        Returns: undefined
      }
      set_property_commission: {
        Args: { _pct: number; _property: string }
        Returns: undefined
      }
      set_property_location_precision: {
        Args: {
          _precision: Database["public"]["Enums"]["location_precision"]
          _property: string
        }
        Returns: undefined
      }
      set_property_status: {
        Args: {
          _property: string
          _reason?: string
          _status: Database["public"]["Enums"]["property_status"]
        }
        Returns: undefined
      }
      set_user_status: {
        Args: {
          _status: Database["public"]["Enums"]["user_status"]
          _user: string
        }
        Returns: undefined
      }
      submit_property: { Args: { _property: string }; Returns: undefined }
    }
    Enums: {
      broker_status: "pendente" | "autorizado" | "bloqueado" | "removido"
      location_precision: "bairro" | "aproximado" | "exato"
      media_kind: "foto" | "video"
      owner_status: "pendente" | "aprovado" | "bloqueado"
      property_condition: "novo" | "usado" | "lancamento"
      property_purpose: "venda" | "locacao" | "venda_locacao"
      property_status:
        | "rascunho"
        | "aguardando_aprovacao"
        | "aprovado"
        | "publicado"
        | "reservado"
        | "em_negociacao"
        | "vendido"
        | "alugado"
        | "pausado"
        | "rejeitado"
        | "cancelado"
      property_type:
        | "casa"
        | "apartamento"
        | "cobertura"
        | "lote"
        | "terreno"
        | "comercial"
        | "sala"
        | "loja"
        | "galpao"
        | "sitio"
        | "fazenda"
      rent_band: "ate_2k" | "de_2k_5k" | "de_5k_10k" | "acima_10k"
      sale_band: "ate_300k" | "de_300k_600k" | "de_600k_1mi" | "acima_1mi"
      user_status: "ativo" | "bloqueado"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      broker_status: ["pendente", "autorizado", "bloqueado", "removido"],
      location_precision: ["bairro", "aproximado", "exato"],
      media_kind: ["foto", "video"],
      owner_status: ["pendente", "aprovado", "bloqueado"],
      property_condition: ["novo", "usado", "lancamento"],
      property_purpose: ["venda", "locacao", "venda_locacao"],
      property_status: [
        "rascunho",
        "aguardando_aprovacao",
        "aprovado",
        "publicado",
        "reservado",
        "em_negociacao",
        "vendido",
        "alugado",
        "pausado",
        "rejeitado",
        "cancelado",
      ],
      property_type: [
        "casa",
        "apartamento",
        "cobertura",
        "lote",
        "terreno",
        "comercial",
        "sala",
        "loja",
        "galpao",
        "sitio",
        "fazenda",
      ],
      rent_band: ["ate_2k", "de_2k_5k", "de_5k_10k", "acima_10k"],
      sale_band: ["ate_300k", "de_300k_600k", "de_600k_1mi", "acima_1mi"],
      user_status: ["ativo", "bloqueado"],
    },
  },
} as const

// --- Atalhos usados pelo app -----------------------------------------------
// Os enums do banco são a fonte da verdade: se alguém acrescentar um status de
// imóvel na migration e esquecer da interface, o TypeScript aponta.

export type UserStatus = Database["public"]["Enums"]["user_status"];
export type BrokerStatus = Database["public"]["Enums"]["broker_status"];
export type OwnerStatus = Database["public"]["Enums"]["owner_status"];
export type PropertyType = Database["public"]["Enums"]["property_type"];
export type PropertyPurpose = Database["public"]["Enums"]["property_purpose"];
export type PropertyCondition = Database["public"]["Enums"]["property_condition"];
export type PropertyStatus = Database["public"]["Enums"]["property_status"];
export type LocationPrecision = Database["public"]["Enums"]["location_precision"];
export type MediaKind = Database["public"]["Enums"]["media_kind"];
export type SaleBand = Database["public"]["Enums"]["sale_band"];
export type RentBand = Database["public"]["Enums"]["rent_band"];
