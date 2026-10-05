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

export interface Database {
  public: {
    Tables: {
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
      broker_status: BrokerStatus;
      owner_status: OwnerStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}
