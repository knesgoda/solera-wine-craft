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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          org_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          active: boolean
          channel: Database["public"]["Enums"]["alert_channel"]
          created_at: string
          id: string
          last_triggered_at: string | null
          operator: Database["public"]["Enums"]["alert_operator"]
          org_id: string
          parameter: Database["public"]["Enums"]["alert_parameter"]
          threshold: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel?: Database["public"]["Enums"]["alert_channel"]
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          operator: Database["public"]["Enums"]["alert_operator"]
          org_id: string
          parameter: Database["public"]["Enums"]["alert_parameter"]
          threshold: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: Database["public"]["Enums"]["alert_channel"]
          created_at?: string
          id?: string
          last_triggered_at?: string | null
          operator?: Database["public"]["Enums"]["alert_operator"]
          org_id?: string
          parameter?: Database["public"]["Enums"]["alert_parameter"]
          threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analog_vintages: {
        Row: {
          created_at: string
          gdd_total: number | null
          harvest_date: string | null
          id: string
          imported: boolean
          notes: string | null
          org_id: string
          rating: number | null
          rating_source: string | null
          region: string
          year: number
        }
        Insert: {
          created_at?: string
          gdd_total?: number | null
          harvest_date?: string | null
          id?: string
          imported?: boolean
          notes?: string | null
          org_id: string
          rating?: number | null
          rating_source?: string | null
          region: string
          year: number
        }
        Update: {
          created_at?: string
          gdd_total?: number | null
          harvest_date?: string | null
          id?: string
          imported?: boolean
          notes?: string | null
          org_id?: string
          rating?: number | null
          rating_source?: string | null
          region?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "analog_vintages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      anomaly_flags: {
        Row: {
          created_at: string
          expected_range_high: number | null
          expected_range_low: number | null
          flagged_at: string
          id: string
          notes: string | null
          org_id: string
          parameter: string
          resolved: boolean
          value: number
          vintage_id: string
        }
        Insert: {
          created_at?: string
          expected_range_high?: number | null
          expected_range_low?: number | null
          flagged_at?: string
          id?: string
          notes?: string | null
          org_id: string
          parameter: string
          resolved?: boolean
          value: number
          vintage_id: string
        }
        Update: {
          created_at?: string
          expected_range_high?: number | null
          expected_range_low?: number | null
          flagged_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          parameter?: string
          resolved?: boolean
          value?: number
          vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_flags_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anomaly_flags_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      barrel_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barrel_groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      barrels: {
        Row: {
          barrel_group_id: string | null
          barrel_id: string | null
          cooperage: string | null
          created_at: string
          empty_date: string | null
          fill_date: string | null
          id: string
          org_id: string
          size_liters: number | null
          status: string | null
          toast: string | null
          type: string | null
          updated_at: string
          variety: string | null
          vintage_id: string | null
        }
        Insert: {
          barrel_group_id?: string | null
          barrel_id?: string | null
          cooperage?: string | null
          created_at?: string
          empty_date?: string | null
          fill_date?: string | null
          id?: string
          org_id: string
          size_liters?: number | null
          status?: string | null
          toast?: string | null
          type?: string | null
          updated_at?: string
          variety?: string | null
          vintage_id?: string | null
        }
        Update: {
          barrel_group_id?: string | null
          barrel_id?: string | null
          cooperage?: string | null
          created_at?: string
          empty_date?: string | null
          fill_date?: string | null
          id?: string
          org_id?: string
          size_liters?: number | null
          status?: string | null
          toast?: string | null
          type?: string | null
          updated_at?: string
          variety?: string | null
          vintage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barrels_barrel_group_id_fkey"
            columns: ["barrel_group_id"]
            isOneToOne: false
            referencedRelation: "barrel_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrels_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      blending_trial_lots: {
        Row: {
          barrel_id: string | null
          created_at: string
          id: string
          percentage: number
          trial_id: string
          vintage_id: string | null
          volume_liters: number | null
        }
        Insert: {
          barrel_id?: string | null
          created_at?: string
          id?: string
          percentage: number
          trial_id: string
          vintage_id?: string | null
          volume_liters?: number | null
        }
        Update: {
          barrel_id?: string | null
          created_at?: string
          id?: string
          percentage?: number
          trial_id?: string
          vintage_id?: string | null
          volume_liters?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blending_trial_lots_barrel_id_fkey"
            columns: ["barrel_id"]
            isOneToOne: false
            referencedRelation: "barrels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blending_trial_lots_trial_id_fkey"
            columns: ["trial_id"]
            isOneToOne: false
            referencedRelation: "blending_trials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blending_trial_lots_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      blending_trials: {
        Row: {
          created_at: string
          finalized: boolean
          id: string
          name: string
          notes: string | null
          org_id: string
          stars: number | null
          total_volume_liters: number | null
          updated_at: string
          vintage_id: string | null
        }
        Insert: {
          created_at?: string
          finalized?: boolean
          id?: string
          name: string
          notes?: string | null
          org_id: string
          stars?: number | null
          total_volume_liters?: number | null
          updated_at?: string
          vintage_id?: string | null
        }
        Update: {
          created_at?: string
          finalized?: boolean
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          stars?: number | null
          total_volume_liters?: number | null
          updated_at?: string
          vintage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blending_trials_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blending_trials_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          acres: number | null
          clone: string | null
          created_at: string
          id: string
          lifecycle_stage:
            | Database["public"]["Enums"]["block_lifecycle_stage"]
            | null
          name: string
          rootstock: string | null
          soil_organic_matter: number | null
          soil_ph: number | null
          soil_texture: string | null
          status: Database["public"]["Enums"]["block_status"]
          updated_at: string
          variety: string | null
          vineyard_id: string
        }
        Insert: {
          acres?: number | null
          clone?: string | null
          created_at?: string
          id?: string
          lifecycle_stage?:
            | Database["public"]["Enums"]["block_lifecycle_stage"]
            | null
          name: string
          rootstock?: string | null
          soil_organic_matter?: number | null
          soil_ph?: number | null
          soil_texture?: string | null
          status?: Database["public"]["Enums"]["block_status"]
          updated_at?: string
          variety?: string | null
          vineyard_id: string
        }
        Update: {
          acres?: number | null
          clone?: string | null
          created_at?: string
          id?: string
          lifecycle_stage?:
            | Database["public"]["Enums"]["block_lifecycle_stage"]
            | null
          name?: string
          rootstock?: string | null
          soil_organic_matter?: number | null
          soil_ph?: number | null
          soil_texture?: string | null
          status?: Database["public"]["Enums"]["block_status"]
          updated_at?: string
          variety?: string | null
          vineyard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_vineyard_id_fkey"
            columns: ["vineyard_id"]
            isOneToOne: false
            referencedRelation: "vineyards"
            referencedColumns: ["id"]
          },
        ]
      }
      club_members: {
        Row: {
          cancelled_at: string | null
          club_id: string
          created_at: string
          customer_id: string
          id: string
          joined_at: string
          next_shipment_date: string | null
          notes: string | null
          org_id: string
          shipping_address_json: Json | null
          status: Database["public"]["Enums"]["club_member_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          club_id: string
          created_at?: string
          customer_id: string
          id?: string
          joined_at?: string
          next_shipment_date?: string | null
          notes?: string | null
          org_id: string
          shipping_address_json?: Json | null
          status?: Database["public"]["Enums"]["club_member_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          club_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          joined_at?: string
          next_shipment_date?: string | null
          notes?: string | null
          org_id?: string
          shipping_address_json?: Json | null
          status?: Database["public"]["Enums"]["club_member_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "wine_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      club_shipment_members: {
        Row: {
          created_at: string
          id: string
          member_id: string
          shipment_id: string
          shipped_at: string | null
          status: Database["public"]["Enums"]["club_shipment_member_status"]
          stripe_payment_intent_id: string | null
          tracking_number: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          shipment_id: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["club_shipment_member_status"]
          stripe_payment_intent_id?: string | null
          tracking_number?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          shipment_id?: string
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["club_shipment_member_status"]
          stripe_payment_intent_id?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "club_shipment_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "club_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_shipment_members_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "club_shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      club_shipments: {
        Row: {
          club_id: string
          created_at: string
          id: string
          notes: string | null
          org_id: string
          shipment_date: string
          sku_allocations_json: Json | null
          status: Database["public"]["Enums"]["club_shipment_status"]
          total_members_billed: number
          total_members_shipped: number
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          shipment_date: string
          sku_allocations_json?: Json | null
          status?: Database["public"]["Enums"]["club_shipment_status"]
          total_members_billed?: number
          total_members_shipped?: number
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          shipment_date?: string
          sku_allocations_json?: Json | null
          status?: Database["public"]["Enums"]["club_shipment_status"]
          total_members_billed?: number
          total_members_shipped?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_shipments_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "wine_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_shipments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_json: Json | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          notes: string | null
          org_id: string
          phone: string | null
          total_orders: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          address_json?: Json | null
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          org_id: string
          phone?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address_json?: Json | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          notes?: string | null
          org_id?: string
          phone?: string | null
          total_orders?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fermentation_logs: {
        Row: {
          brix: number | null
          created_at: string
          id: string
          logged_at: string
          notes: string | null
          temp_f: number | null
          vessel_id: string
          vintage_id: string | null
        }
        Insert: {
          brix?: number | null
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          temp_f?: number | null
          vessel_id: string
          vintage_id?: string | null
        }
        Update: {
          brix?: number | null
          created_at?: string
          id?: string
          logged_at?: string
          notes?: string | null
          temp_f?: number | null
          vessel_id?: string
          vintage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fermentation_logs_vessel_id_fkey"
            columns: ["vessel_id"]
            isOneToOne: false
            referencedRelation: "fermentation_vessels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fermentation_logs_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      fermentation_vessels: {
        Row: {
          capacity_liters: number | null
          created_at: string
          id: string
          material: string | null
          name: string
          notes: string | null
          org_id: string
          temp_controlled: boolean
          updated_at: string
          vintage_id: string | null
        }
        Insert: {
          capacity_liters?: number | null
          created_at?: string
          id?: string
          material?: string | null
          name: string
          notes?: string | null
          org_id: string
          temp_controlled?: boolean
          updated_at?: string
          vintage_id?: string | null
        }
        Update: {
          capacity_liters?: number | null
          created_at?: string
          id?: string
          material?: string | null
          name?: string
          notes?: string | null
          org_id?: string
          temp_controlled?: boolean
          updated_at?: string
          vintage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fermentation_vessels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fermentation_vessels_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sheet_connections: {
        Row: {
          active: boolean
          conflict_resolution: Database["public"]["Enums"]["conflict_resolution"]
          created_at: string
          google_access_token: string | null
          google_refresh_token: string | null
          google_sheet_id: string
          id: string
          last_synced_at: string | null
          module: Database["public"]["Enums"]["sheet_module"]
          org_id: string
          sheet_name: string
          sync_schedule: Database["public"]["Enums"]["sync_schedule"]
          tab_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          conflict_resolution?: Database["public"]["Enums"]["conflict_resolution"]
          created_at?: string
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_sheet_id: string
          id?: string
          last_synced_at?: string | null
          module: Database["public"]["Enums"]["sheet_module"]
          org_id: string
          sheet_name: string
          sync_schedule?: Database["public"]["Enums"]["sync_schedule"]
          tab_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          conflict_resolution?: Database["public"]["Enums"]["conflict_resolution"]
          created_at?: string
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_sheet_id?: string
          id?: string
          last_synced_at?: string | null
          module?: Database["public"]["Enums"]["sheet_module"]
          org_id?: string
          sheet_name?: string
          sync_schedule?: Database["public"]["Enums"]["sync_schedule"]
          tab_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_sheet_connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      harvest_alerts_sent: {
        Row: {
          block_id: string
          id: string
          org_id: string
          sent_at: string
          vintage_id: string
          week_start: string
        }
        Insert: {
          block_id: string
          id?: string
          org_id: string
          sent_at?: string
          vintage_id: string
          week_start: string
        }
        Update: {
          block_id?: string
          id?: string
          org_id?: string
          sent_at?: string
          vintage_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "harvest_alerts_sent_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_alerts_sent_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "harvest_alerts_sent_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          job_id: string
          resolved: boolean
          row_number: number | null
          source_data: Json | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id: string
          resolved?: boolean
          row_number?: number | null
          source_data?: Json | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          job_id?: string
          resolved?: boolean
          row_number?: number | null
          source_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_rows: number | null
          id: string
          imported_rows: number | null
          org_id: string
          skipped_rows: number | null
          source_type: Database["public"]["Enums"]["import_source_type"]
          started_at: string | null
          status: Database["public"]["Enums"]["import_status"]
          total_rows: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          id?: string
          imported_rows?: number | null
          org_id: string
          skipped_rows?: number | null
          source_type: Database["public"]["Enums"]["import_source_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_rows?: number | null
          id?: string
          imported_rows?: number | null
          org_id?: string
          skipped_rows?: number | null
          source_type?: Database["public"]["Enums"]["import_source_type"]
          started_at?: string | null
          status?: Database["public"]["Enums"]["import_status"]
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_mappings: {
        Row: {
          confidence: string | null
          created_at: string
          id: string
          org_id: string
          overridden_by_user: boolean
          source_column: string
          source_type: Database["public"]["Enums"]["import_source_type"]
          target_field: string | null
          target_table: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string
          id?: string
          org_id: string
          overridden_by_user?: boolean
          source_column: string
          source_type: Database["public"]["Enums"]["import_source_type"]
          target_field?: string | null
          target_table?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string
          id?: string
          org_id?: string
          overridden_by_user?: boolean
          source_column?: string
          source_type?: Database["public"]["Enums"]["import_source_type"]
          target_field?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_mappings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjusted_at: string
          adjusted_by: string | null
          bottles_delta: number
          cases_delta: number
          created_at: string
          id: string
          notes: string | null
          org_id: string
          reason: Database["public"]["Enums"]["adjustment_reason"]
          sku_id: string
        }
        Insert: {
          adjusted_at?: string
          adjusted_by?: string | null
          bottles_delta?: number
          cases_delta?: number
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          reason: Database["public"]["Enums"]["adjustment_reason"]
          sku_id: string
        }
        Update: {
          adjusted_at?: string
          adjusted_by?: string | null
          bottles_delta?: number
          cases_delta?: number
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          reason?: Database["public"]["Enums"]["adjustment_reason"]
          sku_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_adjustments_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "inventory_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_skus: {
        Row: {
          active: boolean
          allocation_type: Database["public"]["Enums"]["allocation_type"]
          bottles: number | null
          bottles_per_case: number
          cases: number | null
          cost_per_bottle: number | null
          created_at: string
          id: string
          label: string | null
          label_image_url: string | null
          loose_bottles: number
          notes: string | null
          org_id: string
          price: number | null
          updated_at: string
          variety: string | null
          vintage_id: string | null
          vintage_year: number | null
        }
        Insert: {
          active?: boolean
          allocation_type?: Database["public"]["Enums"]["allocation_type"]
          bottles?: number | null
          bottles_per_case?: number
          cases?: number | null
          cost_per_bottle?: number | null
          created_at?: string
          id?: string
          label?: string | null
          label_image_url?: string | null
          loose_bottles?: number
          notes?: string | null
          org_id: string
          price?: number | null
          updated_at?: string
          variety?: string | null
          vintage_id?: string | null
          vintage_year?: number | null
        }
        Update: {
          active?: boolean
          allocation_type?: Database["public"]["Enums"]["allocation_type"]
          bottles?: number | null
          bottles_per_case?: number
          cases?: number | null
          cost_per_bottle?: number | null
          created_at?: string
          id?: string
          label?: string | null
          label_image_url?: string | null
          loose_bottles?: number
          notes?: string | null
          org_id?: string
          price?: number | null
          updated_at?: string
          variety?: string | null
          vintage_id?: string | null
          vintage_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_skus_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_skus_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_samples: {
        Row: {
          alcohol: number | null
          brix: number | null
          created_at: string
          id: string
          notes: string | null
          offline_queued: boolean
          ph: number | null
          rs: number | null
          sampled_at: string
          so2_free: number | null
          so2_total: number | null
          ta: number | null
          va: number | null
          vintage_id: string
        }
        Insert: {
          alcohol?: number | null
          brix?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          offline_queued?: boolean
          ph?: number | null
          rs?: number | null
          sampled_at: string
          so2_free?: number | null
          so2_total?: number | null
          ta?: number | null
          va?: number | null
          vintage_id: string
        }
        Update: {
          alcohol?: number | null
          brix?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          offline_queued?: boolean
          ph?: number | null
          rs?: number | null
          sampled_at?: string
          so2_free?: number | null
          so2_total?: number | null
          ta?: number | null
          va?: number | null
          vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_samples_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: Database["public"]["Enums"]["alert_channel"]
          created_at: string
          id: string
          message: string
          org_id: string
          read: boolean
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["alert_channel"]
          created_at?: string
          id?: string
          message: string
          org_id: string
          read?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["alert_channel"]
          created_at?: string
          id?: string
          message?: string
          org_id?: string
          read?: boolean
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_address_json: Json | null
          customer_email: string
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          org_id: string
          quantity_bottles: number
          quantity_cases: number
          shipped_at: string | null
          shipping_cost: number
          sku_id: string
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          subtotal: number
          total: number
          tracking_number: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          customer_address_json?: Json | null
          customer_email: string
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          org_id: string
          quantity_bottles?: number
          quantity_cases?: number
          shipped_at?: string | null
          shipping_cost?: number
          sku_id: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          tracking_number?: string | null
          unit_price?: number
        }
        Update: {
          created_at?: string
          customer_address_json?: Json | null
          customer_email?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          org_id?: string
          quantity_bottles?: number
          quantity_cases?: number
          shipped_at?: string | null
          shipping_cost?: number
          sku_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          tracking_number?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "inventory_skus"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          enabled_modules: string[] | null
          id: string
          name: string
          onboarding_completed: boolean
          tier: Database["public"]["Enums"]["org_tier"] | null
          type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled_modules?: string[] | null
          id?: string
          name: string
          onboarding_completed?: boolean
          tier?: Database["public"]["Enums"]["org_tier"] | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled_modules?: string[] | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          tier?: Database["public"]["Enums"]["org_tier"] | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          org_id: string | null
          push_subscription: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          org_id?: string | null
          push_subscription?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          push_subscription?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_ratings_config: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          last_imported_at: string | null
          org_id: string
          source_name: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_imported_at?: string | null
          org_id: string
          source_name: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          last_imported_at?: string | null
          org_id?: string
          source_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "public_ratings_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          config_json: Json
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          config_json?: Json
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          config_json?: Json
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      storefront_config: {
        Row: {
          age_gate_enabled: boolean
          created_at: string
          custom_domain: string | null
          enabled: boolean
          id: string
          org_id: string
          store_description: string | null
          store_logo_url: string | null
          store_name: string | null
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          age_gate_enabled?: boolean
          created_at?: string
          custom_domain?: string | null
          enabled?: boolean
          id?: string
          org_id: string
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          age_gate_enabled?: boolean
          created_at?: string
          custom_domain?: string | null
          enabled?: boolean
          id?: string
          org_id?: string
          store_description?: string | null
          store_logo_url?: string | null
          store_name?: string | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "storefront_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          conflicts: number
          connection_id: string
          created_at: string
          error_details: string | null
          errors: number
          id: string
          rows_synced: number
          status: Database["public"]["Enums"]["sync_status"]
          synced_at: string
        }
        Insert: {
          conflicts?: number
          connection_id: string
          created_at?: string
          error_details?: string | null
          errors?: number
          id?: string
          rows_synced?: number
          status?: Database["public"]["Enums"]["sync_status"]
          synced_at?: string
        }
        Update: {
          conflicts?: number
          connection_id?: string
          created_at?: string
          error_details?: string | null
          errors?: number
          id?: string
          rows_synced?: number
          status?: Database["public"]["Enums"]["sync_status"]
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "google_sheet_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          block_id: string | null
          created_at: string
          due_date: string | null
          gps_lat: number | null
          gps_lng: number | null
          id: string
          instructions: string | null
          offline_queued: boolean
          org_id: string
          photos: string[] | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          block_id?: string | null
          created_at?: string
          due_date?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          instructions?: string | null
          offline_queued?: boolean
          org_id: string
          photos?: string[] | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          block_id?: string | null
          created_at?: string
          due_date?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          id?: string
          instructions?: string | null
          offline_queued?: boolean
          org_id?: string
          photos?: string[] | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ttb_additions: {
        Row: {
          added_at: string
          added_by: string | null
          addition_type: Database["public"]["Enums"]["addition_type"]
          amount: number
          batch_size: number | null
          created_at: string
          id: string
          org_id: string
          ttb_code: string | null
          unit: Database["public"]["Enums"]["addition_unit"]
          vintage_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          addition_type: Database["public"]["Enums"]["addition_type"]
          amount: number
          batch_size?: number | null
          created_at?: string
          id?: string
          org_id: string
          ttb_code?: string | null
          unit: Database["public"]["Enums"]["addition_unit"]
          vintage_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          addition_type?: Database["public"]["Enums"]["addition_type"]
          amount?: number
          batch_size?: number | null
          created_at?: string
          id?: string
          org_id?: string
          ttb_code?: string | null
          unit?: Database["public"]["Enums"]["addition_unit"]
          vintage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ttb_additions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ttb_additions_vintage_id_fkey"
            columns: ["vintage_id"]
            isOneToOne: false
            referencedRelation: "vintages"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vineyard_weather_config: {
        Row: {
          active: boolean
          created_at: string
          gdd_base_temp_f: number
          id: string
          latitude: number | null
          longitude: number | null
          org_id: string
          updated_at: string
          vineyard_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          gdd_base_temp_f?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          org_id: string
          updated_at?: string
          vineyard_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          gdd_base_temp_f?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          org_id?: string
          updated_at?: string
          vineyard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vineyard_weather_config_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vineyard_weather_config_vineyard_id_fkey"
            columns: ["vineyard_id"]
            isOneToOne: true
            referencedRelation: "vineyards"
            referencedColumns: ["id"]
          },
        ]
      }
      vineyards: {
        Row: {
          acres: number | null
          coordinates: string | null
          created_at: string
          id: string
          name: string
          org_id: string
          region: string | null
          updated_at: string
        }
        Insert: {
          acres?: number | null
          coordinates?: string | null
          created_at?: string
          id?: string
          name: string
          org_id: string
          region?: string | null
          updated_at?: string
        }
        Update: {
          acres?: number | null
          coordinates?: string | null
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vineyards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      vintages: {
        Row: {
          block_id: string | null
          client_org_id: string | null
          created_at: string
          harvest_date: string | null
          id: string
          notes: string | null
          org_id: string
          status: Database["public"]["Enums"]["vintage_status"]
          tons_harvested: number | null
          updated_at: string
          year: number
        }
        Insert: {
          block_id?: string | null
          client_org_id?: string | null
          created_at?: string
          harvest_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["vintage_status"]
          tons_harvested?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          block_id?: string | null
          client_org_id?: string | null
          created_at?: string
          harvest_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["vintage_status"]
          tons_harvested?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vintages_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vintages_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vintages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weather_readings: {
        Row: {
          created_at: string
          gdd_cumulative: number | null
          gdd_daily: number | null
          id: string
          org_id: string
          precip_inches: number | null
          recorded_at: string
          source: string
          temp_f: number | null
          temp_max_f: number | null
          temp_min_f: number | null
          vineyard_id: string
          wind_mph: number | null
        }
        Insert: {
          created_at?: string
          gdd_cumulative?: number | null
          gdd_daily?: number | null
          id?: string
          org_id: string
          precip_inches?: number | null
          recorded_at: string
          source?: string
          temp_f?: number | null
          temp_max_f?: number | null
          temp_min_f?: number | null
          vineyard_id: string
          wind_mph?: number | null
        }
        Update: {
          created_at?: string
          gdd_cumulative?: number | null
          gdd_daily?: number | null
          id?: string
          org_id?: string
          precip_inches?: number | null
          recorded_at?: string
          source?: string
          temp_f?: number | null
          temp_max_f?: number | null
          temp_min_f?: number | null
          vineyard_id?: string
          wind_mph?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weather_readings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weather_readings_vineyard_id_fkey"
            columns: ["vineyard_id"]
            isOneToOne: false
            referencedRelation: "vineyards"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_summaries: {
        Row: {
          content: string
          created_at: string
          generated_at: string
          id: string
          org_id: string
          week_starting: string
        }
        Insert: {
          content: string
          created_at?: string
          generated_at?: string
          id?: string
          org_id: string
          week_starting: string
        }
        Update: {
          content?: string
          created_at?: string
          generated_at?: string
          id?: string
          org_id?: string
          week_starting?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_summaries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      wine_clubs: {
        Row: {
          active: boolean
          bottles_per_shipment: number
          created_at: string
          description: string | null
          frequency: Database["public"]["Enums"]["club_frequency"]
          id: string
          name: string
          org_id: string
          price_per_shipment: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          bottles_per_shipment?: number
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["club_frequency"]
          id?: string
          name: string
          org_id: string
          price_per_shipment?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          bottles_per_shipment?: number
          created_at?: string
          description?: string | null
          frequency?: Database["public"]["Enums"]["club_frequency"]
          id?: string
          name?: string
          org_id?: string
          price_per_shipment?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wine_clubs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_conversation_org_id: {
        Args: { _conversation_id: string }
        Returns: string
      }
      get_import_job_org_id: { Args: { _job_id: string }; Returns: string }
      get_sheet_connection_org_id: {
        Args: { _connection_id: string }
        Returns: string
      }
      get_shipment_org_id: { Args: { _shipment_id: string }; Returns: string }
      get_trial_org_id: { Args: { _trial_id: string }; Returns: string }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_vessel_org_id: { Args: { _vessel_id: string }; Returns: string }
      get_vineyard_org_id: { Args: { _vineyard_id: string }; Returns: string }
      get_vintage_org_id: { Args: { _vintage_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      addition_type:
        | "so2"
        | "yeast_nutrient"
        | "enzyme"
        | "fining_agent"
        | "acid"
        | "other"
      addition_unit: "g" | "kg" | "mL" | "L" | "oz" | "lb"
      adjustment_reason:
        | "production_addition"
        | "sale"
        | "breakage"
        | "comp"
        | "audit_correction"
        | "custom_crush_transfer"
      alert_channel: "email" | "push" | "both"
      alert_operator: "gte" | "lte" | "eq"
      alert_parameter:
        | "brix"
        | "ph"
        | "ta"
        | "va"
        | "so2_free"
        | "so2_total"
        | "temp_f"
        | "gdd_cumulative"
      allocation_type:
        | "dtc"
        | "wine_club"
        | "wholesale"
        | "restaurant"
        | "library"
        | "custom_crush_client"
      app_role: "owner" | "admin" | "member"
      block_lifecycle_stage:
        | "planting"
        | "establishment"
        | "bearing"
        | "mature"
        | "replanting"
      block_status: "active" | "inactive" | "removed"
      club_frequency:
        | "monthly"
        | "bimonthly"
        | "quarterly"
        | "twice_yearly"
        | "annual"
      club_member_status: "active" | "paused" | "cancelled" | "payment_failed"
      club_shipment_member_status:
        | "pending"
        | "billed"
        | "payment_failed"
        | "shipped"
      club_shipment_status:
        | "draft"
        | "processing"
        | "billed"
        | "shipping"
        | "completed"
      conflict_resolution: "solera_wins" | "sheet_wins" | "flag_for_review"
      import_source_type: "csv" | "innovint" | "vinnow"
      import_status:
        | "pending"
        | "mapping"
        | "previewing"
        | "importing"
        | "completed"
        | "failed"
      notification_type: "alert" | "harvest" | "system" | "task"
      order_status:
        | "pending"
        | "payment_failed"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "refunded"
      org_tier: "hobbyist" | "small_boutique" | "mid_size" | "enterprise"
      sheet_module: "vintage_lab" | "tasks" | "inventory"
      sync_schedule: "manual" | "hourly" | "daily"
      sync_status: "success" | "partial" | "failed" | "running"
      task_status: "pending" | "in_progress" | "complete"
      vintage_status:
        | "planned"
        | "in_progress"
        | "harvested"
        | "in_cellar"
        | "bottled"
        | "released"
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
      addition_type: [
        "so2",
        "yeast_nutrient",
        "enzyme",
        "fining_agent",
        "acid",
        "other",
      ],
      addition_unit: ["g", "kg", "mL", "L", "oz", "lb"],
      adjustment_reason: [
        "production_addition",
        "sale",
        "breakage",
        "comp",
        "audit_correction",
        "custom_crush_transfer",
      ],
      alert_channel: ["email", "push", "both"],
      alert_operator: ["gte", "lte", "eq"],
      alert_parameter: [
        "brix",
        "ph",
        "ta",
        "va",
        "so2_free",
        "so2_total",
        "temp_f",
        "gdd_cumulative",
      ],
      allocation_type: [
        "dtc",
        "wine_club",
        "wholesale",
        "restaurant",
        "library",
        "custom_crush_client",
      ],
      app_role: ["owner", "admin", "member"],
      block_lifecycle_stage: [
        "planting",
        "establishment",
        "bearing",
        "mature",
        "replanting",
      ],
      block_status: ["active", "inactive", "removed"],
      club_frequency: [
        "monthly",
        "bimonthly",
        "quarterly",
        "twice_yearly",
        "annual",
      ],
      club_member_status: ["active", "paused", "cancelled", "payment_failed"],
      club_shipment_member_status: [
        "pending",
        "billed",
        "payment_failed",
        "shipped",
      ],
      club_shipment_status: [
        "draft",
        "processing",
        "billed",
        "shipping",
        "completed",
      ],
      conflict_resolution: ["solera_wins", "sheet_wins", "flag_for_review"],
      import_source_type: ["csv", "innovint", "vinnow"],
      import_status: [
        "pending",
        "mapping",
        "previewing",
        "importing",
        "completed",
        "failed",
      ],
      notification_type: ["alert", "harvest", "system", "task"],
      order_status: [
        "pending",
        "payment_failed",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "refunded",
      ],
      org_tier: ["hobbyist", "small_boutique", "mid_size", "enterprise"],
      sheet_module: ["vintage_lab", "tasks", "inventory"],
      sync_schedule: ["manual", "hourly", "daily"],
      sync_status: ["success", "partial", "failed", "running"],
      task_status: ["pending", "in_progress", "complete"],
      vintage_status: [
        "planned",
        "in_progress",
        "harvested",
        "in_cellar",
        "bottled",
        "released",
      ],
    },
  },
} as const
