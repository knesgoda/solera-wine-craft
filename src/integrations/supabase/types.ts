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
      inventory_skus: {
        Row: {
          bottles: number | null
          cases: number | null
          created_at: string
          id: string
          label: string | null
          org_id: string
          price: number | null
          updated_at: string
          variety: string | null
          vintage_year: number | null
        }
        Insert: {
          bottles?: number | null
          cases?: number | null
          created_at?: string
          id?: string
          label?: string | null
          org_id: string
          price?: number | null
          updated_at?: string
          variety?: string | null
          vintage_year?: number | null
        }
        Update: {
          bottles?: number | null
          cases?: number | null
          created_at?: string
          id?: string
          label?: string | null
          org_id?: string
          price?: number | null
          updated_at?: string
          variety?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_import_job_org_id: { Args: { _job_id: string }; Returns: string }
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
      app_role: "owner" | "admin" | "member"
      block_lifecycle_stage:
        | "planting"
        | "establishment"
        | "bearing"
        | "mature"
        | "replanting"
      block_status: "active" | "inactive" | "removed"
      import_source_type: "csv" | "innovint" | "vinnow"
      import_status:
        | "pending"
        | "mapping"
        | "previewing"
        | "importing"
        | "completed"
        | "failed"
      org_tier: "hobbyist" | "small_boutique" | "mid_size" | "enterprise"
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
      app_role: ["owner", "admin", "member"],
      block_lifecycle_stage: [
        "planting",
        "establishment",
        "bearing",
        "mature",
        "replanting",
      ],
      block_status: ["active", "inactive", "removed"],
      import_source_type: ["csv", "innovint", "vinnow"],
      import_status: [
        "pending",
        "mapping",
        "previewing",
        "importing",
        "completed",
        "failed",
      ],
      org_tier: ["hobbyist", "small_boutique", "mid_size", "enterprise"],
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
