/**
 * Placeholder até existir um projeto Supabase para gerar os tipos de verdade:
 *
 *   npx supabase gen types typescript --project-id <ref> --schema public \
 *     > src/lib/supabase/database.types.ts
 *
 * Mantenha este arquivo em sincronia com supabase/migrations enquanto isso.
 */

export type UserStatus = "ativo" | "bloqueado";
export type BrokerStatus = "pendente" | "autorizado" | "bloqueado" | "removido";
export type OwnerStatus = "pendente" | "aprovado" | "bloqueado";
export type PropertyType =
  | "casa" | "apartamento" | "cobertura" | "lote" | "terreno" | "comercial"
  | "sala" | "loja" | "galpao" | "sitio" | "fazenda";
export type PropertyPurpose = "venda" | "locacao" | "venda_locacao";
export type PropertyCondition = "novo" | "usado" | "lancamento";
export type PropertyStatus =
  | "aguardando_aprovacao" | "aprovado" | "publicado" | "reservado"
  | "em_negociacao" | "vendido" | "alugado" | "pausado" | "rejeitado" | "cancelado";
export type LocationPrecision = "bairro" | "aproximado" | "exato";
export type MediaKind = "foto" | "video";
export type SaleBand = "ate_300k" | "de_300k_600k" | "de_600k_1mi" | "acima_1mi";
export type RentBand = "ate_2k" | "de_2k_5k" | "de_5k_10k" | "acima_10k";

/** Colunas que o dono pode escrever em `properties`. Ver os GRANTs de 0002. */
type PropertyOwnerWritable = {
  type?: PropertyType;
  purpose?: PropertyPurpose;
  condition?: PropertyCondition;
  in_condominium?: boolean;
  title?: string;
  description?: string;
  features?: string[];
  amenities?: string[];
  bedrooms?: number;
  suites?: number;
  bathrooms?: number;
  parking_spaces?: number;
  total_area?: number | null;
  built_area?: number | null;
  land_area?: number | null;
  condo_fee?: number | null;
  city?: string;
  state?: string;
  neighborhood?: string;
  landmarks?: string;
};

export interface Database {
  public: {
    Tables: {
      properties: {
        Row: {
          id: string;
          code: string;
          type: PropertyType;
          purpose: PropertyPurpose;
          condition: PropertyCondition;
          in_condominium: boolean;
          title: string;
          description: string;
          features: string[];
          amenities: string[];
          bedrooms: number;
          suites: number;
          bathrooms: number;
          parking_spaces: number;
          total_area: number | null;
          built_area: number | null;
          land_area: number | null;
          condo_fee: number | null;
          city: string;
          state: string;
          neighborhood: string;
          approx_lat: number | null;
          approx_lng: number | null;
          location_precision: LocationPrecision;
          landmarks: string;
          status: PropertyStatus;
          rejection_reason: string | null;
          sale_band: SaleBand | null;
          rent_band: RentBand | null;
          published_at: string | null;
          views_count: number;
          created_at: string;
          updated_at: string;
        };
        // Nao existe INSERT direto: o imovel nasce por create_property().
        Insert: never;
        Update: PropertyOwnerWritable;
        Relationships: [];
      };
      property_private: {
        Row: {
          property_id: string;
          owner_id: string;
          price_sale: number | null;
          price_rent: number | null;
          min_price: number | null;
          down_payment: number | null;
          commercial_conditions: string;
          commission_pct: number | null;
          accepts_financing: boolean;
          accepts_trade: boolean;
          address: string;
          street_number: string;
          complement: string;
          cep: string;
          exact_lat: number | null;
          exact_lng: number | null;
          internal_notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: {
          price_sale?: number | null;
          price_rent?: number | null;
          min_price?: number | null;
          down_payment?: number | null;
          commercial_conditions?: string;
          accepts_financing?: boolean;
          accepts_trade?: boolean;
          address?: string;
          street_number?: string;
          complement?: string;
          cep?: string;
          exact_lat?: number | null;
          exact_lng?: number | null;
          internal_notes?: string;
        };
        Relationships: [];
      };
      property_media: {
        Row: {
          id: string;
          property_id: string;
          kind: MediaKind;
          storage_path: string;
          position: number;
          is_cover: boolean;
          created_at: string;
        };
        Insert: {
          property_id: string;
          kind?: MediaKind;
          storage_path: string;
          position?: number;
          is_cover?: boolean;
        };
        Update: { position?: number; is_cover?: boolean };
        Relationships: [];
      };
      property_documents: {
        Row: {
          id: string;
          property_id: string;
          label: string;
          storage_path: string;
          created_at: string;
        };
        Insert: { property_id: string; label?: string; storage_path: string };
        Update: { label?: string };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          status: UserStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; full_name?: string };
        Update: { full_name?: string };
        Relationships: [];
      };
      contacts: {
        Row: {
          user_id: string;
          phone: string | null;
          whatsapp: string | null;
          cpf_cnpj: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          cep: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          phone?: string | null;
          whatsapp?: string | null;
          cpf_cnpj?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          cep?: string | null;
        };
        Update: {
          phone?: string | null;
          whatsapp?: string | null;
          cpf_cnpj?: string | null;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          cep?: string | null;
        };
        Relationships: [];
      };
      brokers: {
        Row: {
          user_id: string;
          creci: string | null;
          phone: string | null;
          bio: string | null;
          status: BrokerStatus;
          applied_at: string;
          decided_at: string | null;
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          creci?: string | null;
          phone?: string | null;
          bio?: string | null;
          status?: BrokerStatus;
        };
        Update: never;
        Relationships: [];
      };
      owner_profiles: {
        Row: {
          user_id: string;
          status: OwnerStatus;
          decided_at: string | null;
          decided_by: string | null;
          created_at: string;
        };
        Insert: { user_id: string; status?: OwnerStatus };
        Update: never;
        Relationships: [];
      };
      platform_admins: {
        Row: { user_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      site_settings: {
        Row: {
          id: boolean;
          master_whatsapp: string;
          master_email: string;
          match_budget_tolerance_pct: number;
          demand_budget_edits_per_day: number;
          updated_at: string;
        };
        Insert: never;
        Update: {
          master_whatsapp?: string;
          master_email?: string;
          match_budget_tolerance_pct?: number;
          demand_budget_edits_per_day?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      create_property: {
        Args: { _type: PropertyType; _purpose: PropertyPurpose; _title?: string };
        Returns: string;
      };
      set_property_status: {
        Args: { _property: string; _status: PropertyStatus; _reason?: string };
        Returns: undefined;
      };
      set_property_location_precision: {
        Args: { _property: string; _precision: LocationPrecision };
        Returns: undefined;
      };
      set_property_commission: { Args: { _property: string; _pct: number }; Returns: undefined };
      submit_property: { Args: { _property: string }; Returns: undefined };
      register_property_view: { Args: { _property: string }; Returns: undefined };
      is_master: { Args: Record<string, never>; Returns: boolean };
      is_active_broker: { Args: Record<string, never>; Returns: boolean };
      my_roles: {
        Args: Record<string, never>;
        Returns: {
          is_master: boolean;
          is_broker: boolean;
          is_owner: boolean;
          broker_status: BrokerStatus | null;
          owner_status: OwnerStatus | null;
        }[];
      };
      set_broker_status: { Args: { _user: string; _status: BrokerStatus }; Returns: undefined };
      set_owner_status: { Args: { _user: string; _status: OwnerStatus }; Returns: undefined };
      set_user_status: { Args: { _user: string; _status: UserStatus }; Returns: undefined };
    };
    Enums: {
      user_status: UserStatus;
      property_type: PropertyType;
      property_purpose: PropertyPurpose;
      property_condition: PropertyCondition;
      property_status: PropertyStatus;
      location_precision: LocationPrecision;
      media_kind: MediaKind;
      sale_band: SaleBand;
      rent_band: RentBand;
      broker_status: BrokerStatus;
      owner_status: OwnerStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
