/**
 * Gerado por `mcp__Supabase__generate_typescript_types` (equivalente a
 * `supabase gen types typescript --project-id spzuvkpovmawbsiznzei`) contra o
 * `hub-dev` já com as migrations 20260917130714_fundacao.sql,
 * 20260918145833_nucleo.sql, 20260918163044_nucleo_security_hardening.sql,
 * 20260919120000_busca_filtros.sql e 20260919130000_midia_jobs.sql
 * aplicadas. Não editar à mão — rode `pnpm db:types` (ou a mesma ferramenta
 * MCP) de novo depois de qualquer migration nova.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      api_tokens: {
        Row: {
          created_at: string;
          expires_at: string | null;
          id: string;
          last_used_at: string | null;
          name: string;
          owner_id: string;
          revoked_at: string | null;
          scopes: string[];
          token_hash: string;
          token_prefix: string;
        };
        Insert: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name: string;
          owner_id?: string;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash: string;
          token_prefix: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          owner_id?: string;
          revoked_at?: string | null;
          scopes?: string[];
          token_hash?: string;
          token_prefix?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          created_at: string;
          duration_seconds: number | null;
          extracted_text: string | null;
          extraction_method: string | null;
          extraction_status: string;
          file_name: string;
          height: number | null;
          id: string;
          item_id: string | null;
          mime_type: string;
          owner_id: string;
          page_count: number | null;
          sha256: string | null;
          size_bytes: number;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          created_at?: string;
          duration_seconds?: number | null;
          extracted_text?: string | null;
          extraction_method?: string | null;
          extraction_status?: string;
          file_name: string;
          height?: number | null;
          id?: string;
          item_id?: string | null;
          mime_type: string;
          owner_id?: string;
          page_count?: number | null;
          sha256?: string | null;
          size_bytes: number;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          duration_seconds?: number | null;
          extracted_text?: string | null;
          extraction_method?: string | null;
          extraction_status?: string;
          file_name?: string;
          height?: number | null;
          id?: string;
          item_id?: string | null;
          mime_type?: string;
          owner_id?: string;
          page_count?: number | null;
          sha256?: string | null;
          size_bytes?: number;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      item_tags: {
        Row: {
          created_at: string;
          item_id: string;
          owner_id: string;
          tag_id: string;
        };
        Insert: {
          created_at?: string;
          item_id: string;
          owner_id?: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          item_id?: string;
          owner_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      item_versions: {
        Row: {
          content: Json | null;
          created_at: string;
          id: string;
          item_id: string;
          label: string | null;
          owner_id: string;
          properties: Json;
          reason: string;
          title: string;
        };
        Insert: {
          content?: Json | null;
          created_at?: string;
          id?: string;
          item_id: string;
          label?: string | null;
          owner_id: string;
          properties: Json;
          reason?: string;
          title: string;
        };
        Update: {
          content?: Json | null;
          created_at?: string;
          id?: string;
          item_id?: string;
          label?: string | null;
          owner_id?: string;
          properties?: Json;
          reason?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_versions_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      items: {
        Row: {
          content: Json | null;
          content_text: string;
          cover_path: string | null;
          created_at: string;
          deleted_at: string | null;
          extra_text: string;
          icon: string | null;
          id: string;
          owner_id: string;
          parent_id: string | null;
          pinned: boolean;
          position: number;
          properties: Json;
          search: unknown;
          source: string | null;
          source_url: string | null;
          space_id: string | null;
          status: string;
          title: string;
          type_id: string | null;
          updated_at: string;
        };
        Insert: {
          content?: Json | null;
          content_text?: string;
          cover_path?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          extra_text?: string;
          icon?: string | null;
          id?: string;
          owner_id?: string;
          parent_id?: string | null;
          pinned?: boolean;
          position?: number;
          properties?: Json;
          search?: unknown;
          source?: string | null;
          source_url?: string | null;
          space_id?: string | null;
          status?: string;
          title?: string;
          type_id?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: Json | null;
          content_text?: string;
          cover_path?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          extra_text?: string;
          icon?: string | null;
          id?: string;
          owner_id?: string;
          parent_id?: string | null;
          pinned?: boolean;
          position?: number;
          properties?: Json;
          search?: unknown;
          source?: string | null;
          source_url?: string | null;
          space_id?: string | null;
          status?: string;
          title?: string;
          type_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "items_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "items_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "object_types";
            referencedColumns: ["id"];
          },
        ];
      };
      job_schedules: {
        Row: {
          created_at: string;
          enabled: boolean;
          interval_seconds: number;
          kind: string;
          last_enqueued_at: string | null;
          owner_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          interval_seconds: number;
          kind: string;
          last_enqueued_at?: string | null;
          owner_id: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          interval_seconds?: number;
          kind?: string;
          last_enqueued_at?: string | null;
          owner_id?: string;
          payload?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          last_error: string | null;
          locked_at: string | null;
          max_attempts: number;
          owner_id: string;
          payload: Json;
          priority: number;
          result: Json | null;
          run_after: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          finished_at?: string | null;
          id?: string;
          kind: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          owner_id: string;
          payload?: Json;
          priority?: number;
          result?: Json | null;
          run_after?: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          dedupe_key?: string | null;
          finished_at?: string | null;
          id?: string;
          kind?: string;
          last_error?: string | null;
          locked_at?: string | null;
          max_attempts?: number;
          owner_id?: string;
          payload?: Json;
          priority?: number;
          result?: Json | null;
          run_after?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      links: {
        Row: {
          created_at: string;
          field_key: string | null;
          id: string;
          kind: string;
          owner_id: string;
          source_id: string;
          target_id: string;
        };
        Insert: {
          created_at?: string;
          field_key?: string | null;
          id?: string;
          kind?: string;
          owner_id?: string;
          source_id: string;
          target_id: string;
        };
        Update: {
          created_at?: string;
          field_key?: string | null;
          id?: string;
          kind?: string;
          owner_id?: string;
          source_id?: string;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "links_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "links_target_id_fkey";
            columns: ["target_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      object_types: {
        Row: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          default_view: string;
          fields: Json;
          icon: string | null;
          id: string;
          is_system: boolean;
          name: string;
          owner_id: string;
          pack_key: string | null;
          plural_name: string | null;
          position: number;
          slug: string;
          space_id: string | null;
          template: Json | null;
          title_template: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          default_view?: string;
          fields?: Json;
          icon?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          owner_id?: string;
          pack_key?: string | null;
          plural_name?: string | null;
          position?: number;
          slug: string;
          space_id?: string | null;
          template?: Json | null;
          title_template?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          default_view?: string;
          fields?: Json;
          icon?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          owner_id?: string;
          pack_key?: string | null;
          plural_name?: string | null;
          position?: number;
          slug?: string;
          space_id?: string | null;
          template?: Json | null;
          title_template?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "object_types_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      spaces: {
        Row: {
          ai_enabled: boolean;
          archived_at: string | null;
          color: string | null;
          created_at: string;
          description: string | null;
          icon: string | null;
          id: string;
          name: string;
          owner_id: string;
          position: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          ai_enabled?: boolean;
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          owner_id?: string;
          position?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          ai_enabled?: boolean;
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          description?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          owner_id?: string;
          position?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          owner_id?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
        };
        Relationships: [];
      };
      transcripts: {
        Row: {
          attachment_id: string;
          created_at: string;
          duration_seconds: number | null;
          error: string | null;
          external_id: string | null;
          id: string;
          item_id: string;
          language: string | null;
          owner_id: string;
          provider: string;
          segments: Json | null;
          speaker_names: Json;
          status: string;
          summary: Json | null;
          text: string | null;
          updated_at: string;
        };
        Insert: {
          attachment_id: string;
          created_at?: string;
          duration_seconds?: number | null;
          error?: string | null;
          external_id?: string | null;
          id?: string;
          item_id: string;
          language?: string | null;
          owner_id?: string;
          provider: string;
          segments?: Json | null;
          speaker_names?: Json;
          status?: string;
          summary?: Json | null;
          text?: string | null;
          updated_at?: string;
        };
        Update: {
          attachment_id?: string;
          created_at?: string;
          duration_seconds?: number | null;
          error?: string | null;
          external_id?: string | null;
          id?: string;
          item_id?: string;
          language?: string | null;
          owner_id?: string;
          provider?: string;
          segments?: Json | null;
          speaker_names?: Json;
          status?: string;
          summary?: Json | null;
          text?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transcripts_attachment_id_fkey";
            columns: ["attachment_id"];
            isOneToOne: false;
            referencedRelation: "attachments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transcripts_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_events: {
        Row: {
          cost_usd: number | null;
          created_at: string;
          feature: string;
          id: string;
          item_id: string | null;
          model: string | null;
          owner_id: string;
          provider: string;
          units: Json;
        };
        Insert: {
          cost_usd?: number | null;
          created_at?: string;
          feature: string;
          id?: string;
          item_id?: string | null;
          model?: string | null;
          owner_id: string;
          provider: string;
          units?: Json;
        };
        Update: {
          cost_usd?: number | null;
          created_at?: string;
          feature?: string;
          id?: string;
          item_id?: string | null;
          model?: string | null;
          owner_id?: string;
          provider?: string;
          units?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "items";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          created_at: string;
          default_space_id: string | null;
          locale: string;
          modules: Json;
          onboarding_completed_at: string | null;
          owner_id: string;
          preferences: Json;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          default_space_id?: string | null;
          locale?: string;
          modules?: Json;
          onboarding_completed_at?: string | null;
          owner_id?: string;
          preferences?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          default_space_id?: string | null;
          locale?: string;
          modules?: Json;
          onboarding_completed_at?: string | null;
          owner_id?: string;
          preferences?: Json;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_default_space_id_fkey";
            columns: ["default_space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
        ];
      };
      views: {
        Row: {
          config: Json;
          created_at: string;
          id: string;
          is_default: boolean;
          kind: string;
          name: string;
          owner_id: string;
          position: number;
          space_id: string | null;
          type_id: string | null;
          updated_at: string;
        };
        Insert: {
          config?: Json;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind: string;
          name: string;
          owner_id?: string;
          position?: number;
          space_id?: string | null;
          type_id?: string | null;
          updated_at?: string;
        };
        Update: {
          config?: Json;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind?: string;
          name?: string;
          owner_id?: string;
          position?: number;
          space_id?: string | null;
          type_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "views_space_id_fkey";
            columns: ["space_id"];
            isOneToOne: false;
            referencedRelation: "spaces";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "views_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "object_types";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_jobs: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          created_at: string;
          dedupe_key: string | null;
          finished_at: string | null;
          id: string;
          kind: string;
          last_error: string | null;
          locked_at: string | null;
          max_attempts: number;
          owner_id: string;
          payload: Json;
          priority: number;
          result: Json | null;
          run_after: string;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      item_backlinks: {
        Args: { p_item_id: string };
        Returns: {
          field_key: string;
          id: string;
          kind: string;
          title: string;
          updated_at: string;
        }[];
      };
      refresh_item_extra_text: {
        Args: { p_item_id: string };
        Returns: undefined;
      };
      search_items: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_space_id?: string;
          p_status?: string;
          p_tag_id?: string;
          p_type_id?: string;
          p_updated_after?: string;
          p_updated_before?: string;
          q: string;
        };
        Returns: {
          id: string;
          rank: number;
          snippet: string;
          space_id: string;
          status: string;
          title: string;
          type_id: string;
          updated_at: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
