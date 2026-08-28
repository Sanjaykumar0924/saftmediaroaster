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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          title: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          title: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          created_at: string
          id: string
          marked_by: string | null
          notes: string | null
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          marked_by?: string | null
          notes?: string | null
          service_date?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      availability: {
        Row: {
          created_at: string
          id: string
          note: string | null
          responsible: boolean | null
          responsible_reason: string | null
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["availability_status"]
          unavailable_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          responsible?: boolean | null
          responsible_reason?: string | null
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["availability_status"]
          unavailable_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          responsible?: boolean | null
          responsible_reason?: string | null
          service_date?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["availability_status"]
          unavailable_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_settings: {
        Row: {
          id: boolean
          members_can_send: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          members_can_send?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          members_can_send?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      checklist_entries: {
        Row: {
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          created_at: string
          id: string
          item_id: string
          returned: boolean
          returned_at: string | null
          returned_by: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_id: string
          returned?: boolean
          returned_at?: string | null
          returned_by?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          id?: string
          item_id?: string
          returned?: boolean
          returned_at?: string | null
          returned_by?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "mpc_services"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_reports: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          kind: string
          reporter_id: string
          service_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          kind?: string
          reporter_id: string
          service_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          kind?: string
          reporter_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_reports_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "mpc_services"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_shares: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          sent_by: string | null
          service_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          sent_by?: string | null
          service_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          sent_by?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_shares_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "mpc_services"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_service_availability: {
        Row: {
          created_at: string
          extra_service_id: string
          id: string
          status: Database["public"]["Enums"]["availability_status"]
          unavailable_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_service_id: string
          id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          unavailable_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extra_service_id?: string
          id?: string
          status?: Database["public"]["Enums"]["availability_status"]
          unavailable_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_service_availability_extra_service_id_fkey"
            columns: ["extra_service_id"]
            isOneToOne: false
            referencedRelation: "extra_services"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_services: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          notes: string | null
          service_date: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notes?: string | null
          service_date: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notes?: string | null
          service_date?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          brand_name: string | null
          category: string
          created_at: string
          created_by: string | null
          id: string
          item_name: string
          notes: string | null
          status: Database["public"]["Enums"]["item_status"]
          updated_at: string
          working_status: Database["public"]["Enums"]["item_working_status"]
        }
        Insert: {
          brand_name?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          working_status?: Database["public"]["Enums"]["item_working_status"]
        }
        Update: {
          brand_name?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["item_status"]
          updated_at?: string
          working_status?: Database["public"]["Enums"]["item_working_status"]
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_name: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_name?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_name?: string | null
        }
        Relationships: []
      }
      mpc_services: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location: string
          name: string
          notes: string | null
          service_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          name: string
          notes?: string | null
          service_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string
          name?: string
          notes?: string | null
          service_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          contact_email: string | null
          created_at: string
          experience: string | null
          full_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          phone: string | null
          photo_url: string | null
          role_title: string | null
          seniority: Database["public"]["Enums"]["seniority_level"] | null
          team: string
          team_id: string | null
          updated_at: string
          username: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          experience?: string | null
          full_name: string
          id: string
          is_active?: boolean
          must_change_password?: boolean
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          team?: string
          team_id?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          experience?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          phone?: string | null
          photo_url?: string | null
          role_title?: string | null
          seniority?: Database["public"]["Enums"]["seniority_level"] | null
          team?: string
          team_id?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      roster: {
        Row: {
          assigned_user_id: string | null
          camera: string | null
          created_at: string
          created_by: string | null
          extra_service_id: string | null
          id: string
          notes: string | null
          published_at: string | null
          role: string
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          camera?: string | null
          created_at?: string
          created_by?: string | null
          extra_service_id?: string | null
          id?: string
          notes?: string | null
          published_at?: string | null
          role: string
          service_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          camera?: string | null
          created_at?: string
          created_by?: string | null
          extra_service_id?: string | null
          id?: string
          notes?: string | null
          published_at?: string | null
          role?: string
          service_date?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "roster_extra_service_id_fkey"
            columns: ["extra_service_id"]
            isOneToOne: false
            referencedRelation: "extra_services"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      purge_finished_mpz_services: { Args: never; Returns: undefined }
      purge_old_checklist_reports: { Args: never; Returns: undefined }
      purge_old_messages: { Args: never; Returns: undefined }
      purge_old_rosters: { Args: never; Returns: undefined }
      run_housekeeping: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "member" | "super_admin" | "team_admin"
      attendance_status: "present" | "absent" | "late" | "excused"
      availability_status: "available" | "unavailable" | "pending"
      item_status: "active" | "inactive"
      item_working_status: "working" | "not_working"
      seniority_level: "super_senior" | "senior" | "junior" | "newbie"
      service_type: "sunday_morning" | "sunday_evening" | "tuesday_evening"
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
      app_role: ["admin", "member", "super_admin", "team_admin"],
      attendance_status: ["present", "absent", "late", "excused"],
      availability_status: ["available", "unavailable", "pending"],
      item_status: ["active", "inactive"],
      item_working_status: ["working", "not_working"],
      seniority_level: ["super_senior", "senior", "junior", "newbie"],
      service_type: ["sunday_morning", "sunday_evening", "tuesday_evening"],
    },
  },
} as const
