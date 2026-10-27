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
      contacts: {
        Row: {
          id: number
          name: string | null
          contact_id: string | null
          first_contact_date: string
          next_contact_date: string | null
          status: Database["public"]["Enums"]["contact_status"]
          backoffice: boolean
          ftd_date_mentioned: string | null
          ftd_date_actual: string | null
          live: boolean
          assigned_to: Database["public"]["Enums"]["assigned_to_type"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          name?: string | null
          contact_id?: string | null
          first_contact_date?: string
          next_contact_date?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          backoffice?: boolean
          ftd_date_mentioned?: string | null
          ftd_date_actual?: string | null
          live?: boolean
          assigned_to?: Database["public"]["Enums"]["assigned_to_type"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          name?: string | null
          contact_id?: string | null
          first_contact_date?: string
          next_contact_date?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          backoffice?: boolean
          ftd_date_mentioned?: string | null
          ftd_date_actual?: string | null
          live?: boolean
          assigned_to?: Database["public"]["Enums"]["assigned_to_type"]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      boosty_custom_columns: {
        Row: {
          id: number
          column_name: string
          data_type: string
          options: string[] | null
          created_at: string
        }
        Insert: {
          id?: number
          column_name: string
          data_type: string
          options?: string[] | null
          created_at?: string
        }
        Update: {
          id?: number
          column_name?: string
          data_type?: string
          options?: string[] | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_column: {
        Args: { column_name: string; column_type: string; table_name: string }
        Returns: undefined
      }
      drop_column: {
        Args: { column_name: string; table_name: string }
        Returns: undefined
      }
      rename_column: {
        Args: {
          new_column_name: string
          old_column_name: string
          table_name: string
        }
        Returns: undefined
      }
    }
    Enums: {
      contact_status: "new" | "outreach_1" | "outreach_2" | "outreach_3" | "outreach_4" | "outreach_5" | "live" | "quit"
      assigned_to_type: "bot" | "Human_AccountExists" | "Human_DepositMade" | "Human_General" | "Human_Manually" | "Human_Trash"
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
      contact_status: ["new", "outreach_1", "outreach_2", "outreach_3", "outreach_4", "outreach_5", "live", "quit"],
      assigned_to_type: ["bot", "Human_AccountExists", "Human_DepositMade", "Human_General", "Human_Manually", "Human_Trash"],
    },
  },
} as const
