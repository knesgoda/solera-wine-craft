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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
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
