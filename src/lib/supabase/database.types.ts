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
      api_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_used_at: string | null
          name: string
          owner_id: string
          revoked_at: string | null
          scopes: string[]
          token_hash: string
          token_prefix: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          owner_id?: string
          revoked_at?: string | null
          scopes?: string[]
          token_hash: string
          token_prefix: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          revoked_at?: string | null
          scopes?: string[]
          token_hash?: string
          token_prefix?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          duration_seconds: number | null
          extracted_text: string | null
          extraction_method: string | null
          extraction_status: string
          file_name: string
          height: number | null
          id: string
          item_id: string | null
          mime_type: string
          owner_id: string
          page_count: number | null
          sha256: string | null
          size_bytes: number
          storage_path: string
          width: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          extracted_text?: string | null
          extraction_method?: string | null
          extraction_status?: string
          file_name: string
          height?: number | null
          id?: string
          item_id?: string | null
          mime_type: string
          owner_id?: string
          page_count?: number | null
          sha256?: string | null
          size_bytes: number
          storage_path: string
          width?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          extracted_text?: string | null
          extraction_method?: string | null
          extraction_status?: string
          file_name?: string
          height?: number | null
          id?: string
          item_id?: string | null
          mime_type?: string
          owner_id?: string
          page_count?: number | null
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_event_log: {
        Row: {
          automation_id: string
          chain_id: string
          created_at: string
          id: number
          item_id: string
          owner_id: string
        }
        Insert: {
          automation_id: string
          chain_id: string
          created_at?: string
          id?: never
          item_id: string
          owner_id: string
        }
        Update: {
          automation_id?: string
          chain_id?: string
          created_at?: string
          id?: never
          item_id?: string
          owner_id?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          detail: Json | null
          id: string
          item_id: string | null
          owner_id: string
          status: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          detail?: Json | null
          id?: string
          item_id?: string | null
          owner_id: string
          status: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          detail?: Json | null
          id?: string
          item_id?: string | null
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          conditions: Json
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          owner_id: string
          pack_key: string | null
          run_count: number
          space_id: string | null
          trigger: Json
          type_id: string | null
          updated_at: string
        }
        Insert: {
          actions: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          owner_id?: string
          pack_key?: string | null
          run_count?: number
          space_id?: string | null
          trigger: Json
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          actions?: Json
          conditions?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          owner_id?: string
          pack_key?: string | null
          run_count?: number
          space_id?: string | null
          trigger?: Json
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          color: string | null
          connection_id: string
          created_at: string
          external_id: string
          id: string
          is_primary: boolean
          last_synced_at: string | null
          name: string
          owner_id: string
          space_id: string | null
          sync_enabled: boolean
          sync_token: string | null
          timezone: string | null
        }
        Insert: {
          color?: string | null
          connection_id: string
          created_at?: string
          external_id: string
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          name: string
          owner_id?: string
          space_id?: string | null
          sync_enabled?: boolean
          sync_token?: string | null
          timezone?: string | null
        }
        Update: {
          color?: string | null
          connection_id?: string
          created_at?: string
          external_id?: string
          id?: string
          is_primary?: boolean
          last_synced_at?: string | null
          name?: string
          owner_id?: string
          space_id?: string | null
          sync_enabled?: boolean
          sync_token?: string | null
          timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendars_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendars_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_edges: {
        Row: {
          canvas_id: string
          created_at: string
          creates_link: boolean
          id: string
          label: string | null
          owner_id: string
          source_node_id: string
          style: Json
          target_node_id: string
        }
        Insert: {
          canvas_id: string
          created_at?: string
          creates_link?: boolean
          id?: string
          label?: string | null
          owner_id?: string
          source_node_id: string
          style?: Json
          target_node_id: string
        }
        Update: {
          canvas_id?: string
          created_at?: string
          creates_link?: boolean
          id?: string
          label?: string | null
          owner_id?: string
          source_node_id?: string
          style?: Json
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canvas_edges_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "canvas_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "canvas_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      canvas_nodes: {
        Row: {
          attachment_id: string | null
          canvas_id: string
          contact_id: string | null
          created_at: string
          data: Json
          height: number | null
          id: string
          item_id: string | null
          kind: string
          owner_id: string
          parent_node_id: string | null
          style: Json
          updated_at: string
          width: number | null
          x: number
          y: number
          z_index: number
        }
        Insert: {
          attachment_id?: string | null
          canvas_id: string
          contact_id?: string | null
          created_at?: string
          data?: Json
          height?: number | null
          id?: string
          item_id?: string | null
          kind: string
          owner_id?: string
          parent_node_id?: string | null
          style?: Json
          updated_at?: string
          width?: number | null
          x: number
          y: number
          z_index?: number
        }
        Update: {
          attachment_id?: string | null
          canvas_id?: string
          contact_id?: string | null
          created_at?: string
          data?: Json
          height?: number | null
          id?: string
          item_id?: string | null
          kind?: string
          owner_id?: string
          parent_node_id?: string | null
          style?: Json
          updated_at?: string
          width?: number | null
          x?: number
          y?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "canvas_nodes_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_canvas_id_fkey"
            columns: ["canvas_id"]
            isOneToOne: false
            referencedRelation: "canvases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "canvas_nodes_parent_node_id_fkey"
            columns: ["parent_node_id"]
            isOneToOne: false
            referencedRelation: "canvas_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      canvases: {
        Row: {
          created_at: string
          id: string
          item_id: string
          owner_id: string
          settings: Json
          updated_at: string
          viewport: Json
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          owner_id?: string
          settings?: Json
          updated_at?: string
          viewport?: Json
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          owner_id?: string
          settings?: Json
          updated_at?: string
          viewport?: Json
        }
        Relationships: [
          {
            foreignKeyName: "canvases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: Json | null
          archived_at: string | null
          avatar_path: string | null
          birthday: string | null
          company: string | null
          consent_at: string | null
          consent_source: string | null
          created_at: string
          email: string | null
          email_opt_in: boolean
          id: string
          name: string
          nickname: string | null
          notes: string | null
          opted_out_at: string | null
          owner_id: string
          phone_e164: string | null
          preferred_channel: string
          properties: Json
          relationship: string
          role: string | null
          space_id: string | null
          updated_at: string
          whatsapp_opt_in: boolean
        }
        Insert: {
          address?: Json | null
          archived_at?: string | null
          avatar_path?: string | null
          birthday?: string | null
          company?: string | null
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          id?: string
          name: string
          nickname?: string | null
          notes?: string | null
          opted_out_at?: string | null
          owner_id?: string
          phone_e164?: string | null
          preferred_channel?: string
          properties?: Json
          relationship?: string
          role?: string | null
          space_id?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Update: {
          address?: Json | null
          archived_at?: string | null
          avatar_path?: string | null
          birthday?: string | null
          company?: string | null
          consent_at?: string | null
          consent_source?: string | null
          created_at?: string
          email?: string | null
          email_opt_in?: boolean
          id?: string
          name?: string
          nickname?: string | null
          notes?: string | null
          opted_out_at?: string | null
          owner_id?: string
          phone_e164?: string | null
          preferred_channel?: string
          properties?: Json
          relationship?: string
          role?: string | null
          space_id?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contacts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean
          attendees: Json
          calendar_id: string | null
          conference_url: string | null
          created_at: string
          description: string | null
          ends_at: string
          external_id: string | null
          id: string
          item_id: string | null
          local_dirty: boolean
          location: string | null
          owner_id: string
          recurring_event_external_id: string | null
          remote_etag: string | null
          remote_updated_at: string | null
          starts_at: string
          status: string
          timezone: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          attendees?: Json
          calendar_id?: string | null
          conference_url?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          item_id?: string | null
          local_dirty?: boolean
          location?: string | null
          owner_id?: string
          recurring_event_external_id?: string | null
          remote_etag?: string | null
          remote_updated_at?: string | null
          starts_at: string
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          attendees?: Json
          calendar_id?: string | null
          conference_url?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          item_id?: string | null
          local_dirty?: boolean
          location?: string | null
          owner_id?: string
          recurring_event_external_id?: string | null
          remote_etag?: string | null
          remote_updated_at?: string | null
          starts_at?: string
          status?: string
          timezone?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_accounts: {
        Row: {
          archived_at: string | null
          closing_day: number | null
          color: string | null
          created_at: string
          credit_limit_cents: number | null
          currency: string
          due_day: number | null
          id: string
          include_in_totals: boolean
          institution: string | null
          kind: string
          name: string
          opening_balance_cents: number
          opening_date: string
          owner_id: string
          payment_account_id: string | null
          position: number
          space_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          credit_limit_cents?: number | null
          currency?: string
          due_day?: number | null
          id?: string
          include_in_totals?: boolean
          institution?: string | null
          kind: string
          name: string
          opening_balance_cents?: number
          opening_date?: string
          owner_id?: string
          payment_account_id?: string | null
          position?: number
          space_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          closing_day?: number | null
          color?: string | null
          created_at?: string
          credit_limit_cents?: number | null
          currency?: string
          due_day?: number | null
          id?: string
          include_in_totals?: boolean
          institution?: string | null
          kind?: string
          name?: string
          opening_balance_cents?: number
          opening_date?: string
          owner_id?: string
          payment_account_id?: string | null
          position?: number
          space_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_accounts_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_accounts_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_accounts_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_bills: {
        Row: {
          account_id: string | null
          amount_cents: number
          attachment_id: string | null
          barcode: string | null
          category_id: string | null
          claimed_paid_at: string | null
          contact_id: string | null
          created_at: string
          description: string
          direction: string
          due_on: string
          id: string
          item_id: string | null
          notes: string | null
          owner_id: string
          paid_at: string | null
          paid_cents: number
          pix_code: string | null
          recurring_id: string | null
          space_id: string | null
          statement_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          attachment_id?: string | null
          barcode?: string | null
          category_id?: string | null
          claimed_paid_at?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          direction: string
          due_on: string
          id?: string
          item_id?: string | null
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          paid_cents?: number
          pix_code?: string | null
          recurring_id?: string | null
          space_id?: string | null
          statement_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          attachment_id?: string | null
          barcode?: string | null
          category_id?: string | null
          claimed_paid_at?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          direction?: string
          due_on?: string
          id?: string
          item_id?: string | null
          notes?: string | null
          owner_id?: string
          paid_at?: string | null
          paid_cents?: number
          pix_code?: string | null
          recurring_id?: string | null
          space_id?: string | null
          statement_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_bills_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "fin_recurring"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_bills_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "fin_card_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_budget_alerts: {
        Row: {
          category_id: string
          id: string
          month: string
          notified_at: string
          owner_id: string
          threshold: number
        }
        Insert: {
          category_id: string
          id?: string
          month: string
          notified_at?: string
          owner_id?: string
          threshold: number
        }
        Update: {
          category_id?: string
          id?: string
          month?: string
          notified_at?: string
          owner_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_budget_alerts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_card_statements: {
        Row: {
          account_id: string
          created_at: string
          due_on: string
          id: string
          owner_id: string
          paid_cents: number
          period_end: string
          period_start: string
          reference_month: string
          status: string
        }
        Insert: {
          account_id: string
          created_at?: string
          due_on: string
          id?: string
          owner_id?: string
          paid_cents?: number
          period_end: string
          period_start: string
          reference_month: string
          status?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          due_on?: string
          id?: string
          owner_id?: string
          paid_cents?: number
          period_end?: string
          period_start?: string
          reference_month?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_card_statements_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_categories: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          kind: string
          monthly_budget_cents: number | null
          name: string
          owner_id: string
          parent_id: string | null
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind: string
          monthly_budget_cents?: number | null
          name: string
          owner_id?: string
          parent_id?: string | null
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          kind?: string
          monthly_budget_cents?: number | null
          name?: string
          owner_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_imports: {
        Row: {
          account_id: string
          attachment_id: string | null
          created_at: string
          csv_mapping: Json | null
          format: string
          id: string
          owner_id: string
          rows_duplicate: number
          rows_error: number
          rows_imported: number
          rows_total: number
          status: string
        }
        Insert: {
          account_id: string
          attachment_id?: string | null
          created_at?: string
          csv_mapping?: Json | null
          format: string
          id?: string
          owner_id?: string
          rows_duplicate?: number
          rows_error?: number
          rows_imported?: number
          rows_total?: number
          status?: string
        }
        Update: {
          account_id?: string
          attachment_id?: string | null
          created_at?: string
          csv_mapping?: Json | null
          format?: string
          id?: string
          owner_id?: string
          rows_duplicate?: number
          rows_error?: number
          rows_imported?: number
          rows_total?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_imports_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_imports_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_pix_keys: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          key_type: string
          key_value: string
          label: string
          merchant_city: string
          merchant_name: string
          owner_id: string
          space_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          key_type: string
          key_value: string
          label: string
          merchant_city: string
          merchant_name: string
          owner_id?: string
          space_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          key_type?: string
          key_value?: string
          label?: string
          merchant_city?: string
          merchant_name?: string
          owner_id?: string
          space_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_pix_keys_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_recurring: {
        Row: {
          account_id: string | null
          active: boolean
          amount_cents: number
          amount_is_estimate: boolean
          category_id: string | null
          contact_id: string | null
          created_at: string
          description: string
          direction: string
          ends_on: string | null
          id: string
          next_due_on: string
          owner_id: string
          remind_days_before: number | null
          rrule: string
          space_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount_cents: number
          amount_is_estimate?: boolean
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          direction: string
          ends_on?: string | null
          id?: string
          next_due_on: string
          owner_id?: string
          remind_days_before?: number | null
          rrule: string
          space_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount_cents?: number
          amount_is_estimate?: boolean
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          direction?: string
          ends_on?: string | null
          id?: string
          next_due_on?: string
          owner_id?: string
          remind_days_before?: number | null
          rrule?: string
          space_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_recurring_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_recurring_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recurring_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recurring_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_recurring_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_rules: {
        Row: {
          account_id: string | null
          amount_max_cents: number | null
          amount_min_cents: number | null
          created_at: string
          id: string
          match_field: string
          match_type: string
          owner_id: string
          pattern: string
          priority: number
          set_category_id: string | null
          set_contact_id: string | null
          set_description: string | null
          set_space_id: string | null
          times_applied: number
        }
        Insert: {
          account_id?: string | null
          amount_max_cents?: number | null
          amount_min_cents?: number | null
          created_at?: string
          id?: string
          match_field?: string
          match_type?: string
          owner_id?: string
          pattern: string
          priority?: number
          set_category_id?: string | null
          set_contact_id?: string | null
          set_description?: string | null
          set_space_id?: string | null
          times_applied?: number
        }
        Update: {
          account_id?: string | null
          amount_max_cents?: number | null
          amount_min_cents?: number | null
          created_at?: string
          id?: string
          match_field?: string
          match_type?: string
          owner_id?: string
          pattern?: string
          priority?: number
          set_category_id?: string | null
          set_contact_id?: string | null
          set_description?: string | null
          set_space_id?: string | null
          times_applied?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_rules_set_category_id_fkey"
            columns: ["set_category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_rules_set_contact_id_fkey"
            columns: ["set_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_rules_set_space_id_fkey"
            columns: ["set_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_split_shares: {
        Row: {
          claimed_paid_at: string | null
          contact_id: string | null
          id: string
          owner_id: string
          settled_at: string | null
          settled_cents: number
          settlement_transaction_id: string | null
          share_cents: number
          split_id: string
          weight: number | null
        }
        Insert: {
          claimed_paid_at?: string | null
          contact_id?: string | null
          id?: string
          owner_id?: string
          settled_at?: string | null
          settled_cents?: number
          settlement_transaction_id?: string | null
          share_cents: number
          split_id: string
          weight?: number | null
        }
        Update: {
          claimed_paid_at?: string | null
          contact_id?: string | null
          id?: string
          owner_id?: string
          settled_at?: string | null
          settled_cents?: number
          settlement_transaction_id?: string | null
          share_cents?: number
          split_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fin_split_shares_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_split_shares_settlement_transaction_id_fkey"
            columns: ["settlement_transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_split_shares_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "fin_splits"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_splits: {
        Row: {
          attachment_id: string | null
          created_at: string
          group_label: string | null
          id: string
          method: string
          notes: string | null
          occurred_on: string
          owner_id: string
          paid_by_contact_id: string | null
          status: string
          title: string
          total_cents: number
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          attachment_id?: string | null
          created_at?: string
          group_label?: string | null
          id?: string
          method?: string
          notes?: string | null
          occurred_on?: string
          owner_id?: string
          paid_by_contact_id?: string | null
          status?: string
          title: string
          total_cents: number
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          attachment_id?: string | null
          created_at?: string
          group_label?: string | null
          id?: string
          method?: string
          notes?: string | null
          occurred_on?: string
          owner_id?: string
          paid_by_contact_id?: string | null
          status?: string
          title?: string
          total_cents?: number
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_splits_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_splits_paid_by_contact_id_fkey"
            columns: ["paid_by_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "fin_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_transactions: {
        Row: {
          account_id: string
          amount_cents: number
          bill_id: string | null
          category_id: string | null
          contact_id: string | null
          created_at: string
          description: string
          external_id: string | null
          id: string
          import_hash: string | null
          import_id: string | null
          installment_group_id: string | null
          installment_number: number | null
          installment_total: number | null
          item_id: string | null
          kind: string
          notes: string | null
          occurred_on: string
          original_description: string | null
          owner_id: string
          space_id: string | null
          statement_id: string | null
          status: string
          tags: string[]
          transfer_group_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          amount_cents: number
          bill_id?: string | null
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          description: string
          external_id?: string | null
          id?: string
          import_hash?: string | null
          import_id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          item_id?: string | null
          kind?: string
          notes?: string | null
          occurred_on: string
          original_description?: string | null
          owner_id?: string
          space_id?: string | null
          statement_id?: string | null
          status?: string
          tags?: string[]
          transfer_group_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount_cents?: number
          bill_id?: string | null
          category_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string
          external_id?: string | null
          id?: string
          import_hash?: string | null
          import_id?: string | null
          installment_group_id?: string | null
          installment_number?: number | null
          installment_total?: number | null
          item_id?: string | null
          kind?: string
          notes?: string | null
          occurred_on?: string
          original_description?: string | null
          owner_id?: string
          space_id?: string | null
          statement_id?: string | null
          status?: string
          tags?: string[]
          transfer_group_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fin_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "fin_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "fin_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "fin_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "fin_card_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_token_encrypted: string | null
          access_token_expires_at: string | null
          created_at: string
          google_email: string
          id: string
          last_error: string | null
          owner_id: string
          refresh_token_encrypted: string
          scopes: string[]
          status: string
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_email: string
          id?: string
          last_error?: string | null
          owner_id?: string
          refresh_token_encrypted: string
          scopes: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          access_token_expires_at?: string | null
          created_at?: string
          google_email?: string
          id?: string
          last_error?: string | null
          owner_id?: string
          refresh_token_encrypted?: string
          scopes?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      item_contacts: {
        Row: {
          contact_id: string
          item_id: string
          owner_id: string
          role: string | null
        }
        Insert: {
          contact_id: string
          item_id: string
          owner_id?: string
          role?: string | null
        }
        Update: {
          contact_id?: string
          item_id?: string
          owner_id?: string
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_contacts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_tags: {
        Row: {
          created_at: string
          item_id: string
          owner_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          owner_id?: string
          tag_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          owner_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_tags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      item_versions: {
        Row: {
          content: Json | null
          created_at: string
          id: string
          item_id: string
          label: string | null
          owner_id: string
          properties: Json
          reason: string
          title: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          id?: string
          item_id: string
          label?: string | null
          owner_id: string
          properties: Json
          reason?: string
          title: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          id?: string
          item_id?: string
          label?: string | null
          owner_id?: string
          properties?: Json
          reason?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_versions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          content: Json | null
          content_text: string
          cover_path: string | null
          created_at: string
          deleted_at: string | null
          extra_text: string
          icon: string | null
          id: string
          owner_id: string
          parent_id: string | null
          pinned: boolean
          position: number
          properties: Json
          search: unknown
          source: string | null
          source_url: string | null
          space_id: string | null
          status: string
          title: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          content?: Json | null
          content_text?: string
          cover_path?: string | null
          created_at?: string
          deleted_at?: string | null
          extra_text?: string
          icon?: string | null
          id?: string
          owner_id?: string
          parent_id?: string | null
          pinned?: boolean
          position?: number
          properties?: Json
          search?: unknown
          source?: string | null
          source_url?: string | null
          space_id?: string | null
          status?: string
          title?: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json | null
          content_text?: string
          cover_path?: string | null
          created_at?: string
          deleted_at?: string | null
          extra_text?: string
          icon?: string | null
          id?: string
          owner_id?: string
          parent_id?: string | null
          pinned?: boolean
          position?: number
          properties?: Json
          search?: unknown
          source?: string | null
          source_url?: string | null
          space_id?: string | null
          status?: string
          title?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
      job_schedules: {
        Row: {
          created_at: string
          enabled: boolean
          interval_seconds: number
          kind: string
          last_enqueued_at: string | null
          owner_id: string
          payload: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          interval_seconds: number
          kind: string
          last_enqueued_at?: string | null
          owner_id: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          interval_seconds?: number
          kind?: string
          last_enqueued_at?: string | null
          owner_id?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          owner_id: string
          payload: Json
          priority: number
          result: Json | null
          run_after: string
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          kind: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          owner_id: string
          payload?: Json
          priority?: number
          result?: Json | null
          run_after?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string | null
          finished_at?: string | null
          id?: string
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          max_attempts?: number
          owner_id?: string
          payload?: Json
          priority?: number
          result?: Json | null
          run_after?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      links: {
        Row: {
          created_at: string
          field_key: string | null
          id: string
          kind: string
          owner_id: string
          source_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          field_key?: string | null
          id?: string
          kind?: string
          owner_id?: string
          source_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          field_key?: string | null
          id?: string
          kind?: string
          owner_id?: string
          source_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "links_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "links_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      object_types: {
        Row: {
          archived_at: string | null
          color: string | null
          created_at: string
          default_view: string
          fields: Json
          icon: string | null
          id: string
          is_system: boolean
          name: string
          owner_id: string
          pack_key: string | null
          plural_name: string | null
          position: number
          slug: string
          space_id: string | null
          template: Json | null
          title_template: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          default_view?: string
          fields?: Json
          icon?: string | null
          id?: string
          is_system?: boolean
          name: string
          owner_id?: string
          pack_key?: string | null
          plural_name?: string | null
          position?: number
          slug: string
          space_id?: string | null
          template?: Json | null
          title_template?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          color?: string | null
          created_at?: string
          default_view?: string
          fields?: Json
          icon?: string | null
          id?: string
          is_system?: boolean
          name?: string
          owner_id?: string
          pack_key?: string | null
          plural_name?: string | null
          position?: number
          slug?: string
          space_id?: string | null
          template?: Json | null
          title_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "object_types_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      packs_installed: {
        Row: {
          id: string
          installed_at: string
          mapping: Json
          owner_id: string
          pack_key: string
          space_id: string | null
          version: string
        }
        Insert: {
          id?: string
          installed_at?: string
          mapping?: Json
          owner_id?: string
          pack_key: string
          space_id?: string | null
          version: string
        }
        Update: {
          id?: string
          installed_at?: string
          mapping?: Json
          owner_id?: string
          pack_key?: string
          space_id?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_installed_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          owner_id: string
          p256dh: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          owner_id?: string
          p256dh: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          owner_id?: string
          p256dh?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      reminder_deliveries: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          destination: string | null
          error: string | null
          id: string
          occurrence_at: string
          owner_id: string
          provider_message_id: string | null
          reminder_id: string
          rendered_message: string
          skip_reason: string | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          contact_id?: string | null
          created_at?: string
          destination?: string | null
          error?: string | null
          id?: string
          occurrence_at: string
          owner_id: string
          provider_message_id?: string | null
          reminder_id: string
          rendered_message: string
          skip_reason?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          destination?: string | null
          error?: string | null
          id?: string
          occurrence_at?: string
          owner_id?: string
          provider_message_id?: string | null
          reminder_id?: string
          rendered_message?: string
          skip_reason?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_deliveries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_deliveries_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_rules: {
        Row: {
          channel: string
          config: Json
          created_at: string
          enabled: boolean
          id: string
          kind: string
          message_template: string
          name: string
          owner_id: string
          recipient_type: string
          updated_at: string
        }
        Insert: {
          channel?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          message_template: string
          name: string
          owner_id?: string
          recipient_type?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          config?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          message_template?: string
          name?: string
          owner_id?: string
          recipient_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          channel: string
          contact_ids: string[]
          created_at: string
          ends_at: string | null
          id: string
          item_id: string | null
          last_sent_at: string | null
          message_template: string
          owner_id: string
          recipient_type: string
          rrule: string | null
          rule_id: string | null
          send_at: string
          source_id: string | null
          source_type: string | null
          status: string
          timezone: string
          title: string
          updated_at: string
          variables: Json
        }
        Insert: {
          channel: string
          contact_ids?: string[]
          created_at?: string
          ends_at?: string | null
          id?: string
          item_id?: string | null
          last_sent_at?: string | null
          message_template: string
          owner_id?: string
          recipient_type: string
          rrule?: string | null
          rule_id?: string | null
          send_at: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          timezone?: string
          title: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          channel?: string
          contact_ids?: string[]
          created_at?: string
          ends_at?: string | null
          id?: string
          item_id?: string | null
          last_sent_at?: string | null
          message_template?: string
          owner_id?: string
          recipient_type?: string
          rrule?: string | null
          rule_id?: string | null
          send_at?: string
          source_id?: string | null
          source_type?: string | null
          status?: string
          timezone?: string
          title?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reminders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      review_cards: {
        Row: {
          created_at: string
          deck_item_id: string | null
          difficulty: number
          due_at: string
          elapsed_days: number
          id: string
          item_id: string
          lapses: number
          last_review_at: string | null
          owner_id: string
          reps: number
          scheduled_days: number
          stability: number
          state: string
          suspended: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          deck_item_id?: string | null
          difficulty?: number
          due_at?: string
          elapsed_days?: number
          id?: string
          item_id: string
          lapses?: number
          last_review_at?: string | null
          owner_id?: string
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: string
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          deck_item_id?: string | null
          difficulty?: number
          due_at?: string
          elapsed_days?: number
          id?: string
          item_id?: string
          lapses?: number
          last_review_at?: string | null
          owner_id?: string
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: string
          suspended?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_cards_deck_item_id_fkey"
            columns: ["deck_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_cards_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      review_logs: {
        Row: {
          card_id: string
          difficulty_after: number | null
          due_before: string | null
          duration_ms: number | null
          id: string
          owner_id: string
          rating: number
          reviewed_at: string
          stability_after: number | null
          state_before: string
        }
        Insert: {
          card_id: string
          difficulty_after?: number | null
          due_before?: string | null
          duration_ms?: number | null
          id?: string
          owner_id: string
          rating: number
          reviewed_at?: string
          stability_after?: number | null
          state_before: string
        }
        Update: {
          card_id?: string
          difficulty_after?: number | null
          due_before?: string | null
          duration_ms?: number | null
          id?: string
          owner_id?: string
          rating?: number
          reviewed_at?: string
          stability_after?: number | null
          state_before?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "review_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      share_comments: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          owner_id: string
          read_at: string | null
          share_link_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          owner_id: string
          read_at?: string | null
          share_link_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          owner_id?: string
          read_at?: string | null
          share_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_comments_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      share_link_views: {
        Row: {
          created_at: string
          id: number
          ip_hash: string | null
          owner_id: string
          share_link_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: never
          ip_hash?: string | null
          owner_id: string
          share_link_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: never
          ip_hash?: string | null
          owner_id?: string
          share_link_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_link_views_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          contact_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          include_attachments: boolean
          label: string | null
          last_viewed_at: string | null
          owner_id: string
          password_hash: string | null
          permission: string
          resource_id: string
          resource_type: string
          revoked_at: string | null
          show_full_split: boolean
          token_hash: string
          token_prefix: string
          view_count: number
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          include_attachments?: boolean
          label?: string | null
          last_viewed_at?: string | null
          owner_id?: string
          password_hash?: string | null
          permission?: string
          resource_id: string
          resource_type: string
          revoked_at?: string | null
          show_full_split?: boolean
          token_hash: string
          token_prefix: string
          view_count?: number
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          include_attachments?: boolean
          label?: string | null
          last_viewed_at?: string | null
          owner_id?: string
          password_hash?: string | null
          permission?: string
          resource_id?: string
          resource_type?: string
          revoked_at?: string | null
          show_full_split?: boolean
          token_hash?: string
          token_prefix?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "share_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          ai_enabled: boolean
          archived_at: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          owner_id: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          owner_id?: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          archived_at?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          item_id: string | null
          kind: string
          notes: string | null
          owner_id: string
          started_at: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          item_id?: string | null
          kind?: string
          notes?: string | null
          owner_id?: string
          started_at: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          item_id?: string | null
          kind?: string
          notes?: string | null
          owner_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      transcripts: {
        Row: {
          attachment_id: string
          created_at: string
          duration_seconds: number | null
          error: string | null
          external_id: string | null
          id: string
          item_id: string
          language: string | null
          owner_id: string
          provider: string
          segments: Json | null
          speaker_names: Json
          status: string
          summarize: boolean
          summary: Json | null
          text: string | null
          updated_at: string
        }
        Insert: {
          attachment_id: string
          created_at?: string
          duration_seconds?: number | null
          error?: string | null
          external_id?: string | null
          id?: string
          item_id: string
          language?: string | null
          owner_id?: string
          provider: string
          segments?: Json | null
          speaker_names?: Json
          status?: string
          summarize?: boolean
          summary?: Json | null
          text?: string | null
          updated_at?: string
        }
        Update: {
          attachment_id?: string
          created_at?: string
          duration_seconds?: number | null
          error?: string | null
          external_id?: string | null
          id?: string
          item_id?: string
          language?: string | null
          owner_id?: string
          provider?: string
          segments?: Json | null
          speaker_names?: Json
          status?: string
          summarize?: boolean
          summary?: Json | null
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_attachment_id_fkey"
            columns: ["attachment_id"]
            isOneToOne: false
            referencedRelation: "attachments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transcripts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          cost_usd: number | null
          created_at: string
          feature: string
          id: string
          item_id: string | null
          model: string | null
          owner_id: string
          provider: string
          units: Json
        }
        Insert: {
          cost_usd?: number | null
          created_at?: string
          feature: string
          id?: string
          item_id?: string | null
          model?: string | null
          owner_id: string
          provider: string
          units?: Json
        }
        Update: {
          cost_usd?: number | null
          created_at?: string
          feature?: string
          id?: string
          item_id?: string | null
          model?: string | null
          owner_id?: string
          provider?: string
          units?: Json
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          default_space_id: string | null
          locale: string
          modules: Json
          onboarding_completed_at: string | null
          owner_id: string
          preferences: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_space_id?: string | null
          locale?: string
          modules?: Json
          onboarding_completed_at?: string | null
          owner_id?: string
          preferences?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_space_id?: string | null
          locale?: string
          modules?: Json
          onboarding_completed_at?: string | null
          owner_id?: string
          preferences?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_default_space_id_fkey"
            columns: ["default_space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      views: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_default: boolean
          kind: string
          name: string
          owner_id: string
          position: number
          space_id: string | null
          type_id: string | null
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          kind: string
          name: string
          owner_id?: string
          position?: number
          space_id?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          owner_id?: string
          position?: number
          space_id?: string | null
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "views_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "views_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "object_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fin_account_balances: {
        Row: {
          account_id: string | null
          balance_cents: number | null
          owner_id: string | null
          pending_cents: number | null
        }
        Relationships: []
      }
      fin_contact_balances: {
        Row: {
          balance_cents: number | null
          contact_id: string | null
          owner_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_jobs: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          dedupe_key: string | null
          finished_at: string | null
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          max_attempts: number
          owner_id: string
          payload: Json
          priority: number
          result: Json | null
          run_after: string
          status: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      item_backlinks: {
        Args: { p_item_id: string }
        Returns: {
          field_key: string
          id: string
          kind: string
          title: string
          updated_at: string
        }[]
      }
      refresh_item_extra_text: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      search_items: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_space_id?: string
          p_status?: string
          p_tag_id?: string
          p_type_id?: string
          p_updated_after?: string
          p_updated_before?: string
          q: string
        }
        Returns: {
          id: string
          rank: number
          snippet: string
          space_id: string
          status: string
          title: string
          type_id: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
