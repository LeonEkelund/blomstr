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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      asset_versions: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"]
          asset_id: string
          body: string | null
          created_at: string
          created_by: string
          drive_file_id: string | null
          id: string
          storage_path: string | null
          version_number: number
          workspace_id: string
        }
        Insert: {
          approval_state?: Database["public"]["Enums"]["approval_state"]
          asset_id: string
          body?: string | null
          created_at?: string
          created_by?: string
          drive_file_id?: string | null
          id?: string
          storage_path?: string | null
          version_number: number
          workspace_id: string
        }
        Update: {
          approval_state?: Database["public"]["Enums"]["approval_state"]
          asset_id?: string
          body?: string | null
          created_at?: string
          created_by?: string
          drive_file_id?: string | null
          id?: string
          storage_path?: string | null
          version_number?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_versions_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          content_item_id: string
          created_at: string
          draft_body: string | null
          id: string
          kind: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          draft_body?: string | null
          id?: string
          kind: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          draft_body?: string | null
          id?: string
          kind?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_item_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          anchor: Json | null
          author_id: string
          body: string
          created_at: string
          id: string
          parent_id: string | null
          resolved_at: string | null
          subject_id: string
          subject_type: string
          workspace_id: string
        }
        Insert: {
          anchor?: Json | null
          author_id?: string
          body: string
          created_at?: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          subject_id: string
          subject_type: string
          workspace_id: string
        }
        Update: {
          anchor?: Json | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          resolved_at?: string | null
          subject_id?: string
          subject_type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_item_assignees: {
        Row: {
          content_item_id: string
          user_id: string
        }
        Insert: {
          content_item_id: string
          user_id: string
        }
        Update: {
          content_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_item_assignees_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_item_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_item_assignees_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          ancestor_ids: string[]
          archived_at: string | null
          created_at: string
          created_by: string
          due_at: string | null
          id: string
          notes: string | null
          parent_id: string | null
          platforms: Database["public"]["Enums"]["platform"][]
          position: string
          publish_at: string | null
          source_end_ms: number | null
          source_start_ms: number | null
          stage_id: string
          title: string
          type: Database["public"]["Enums"]["content_type"] | null
          workspace_id: string
        }
        Insert: {
          ancestor_ids?: string[]
          archived_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          parent_id?: string | null
          platforms?: Database["public"]["Enums"]["platform"][]
          position: string
          publish_at?: string | null
          source_end_ms?: number | null
          source_start_ms?: number | null
          stage_id: string
          title: string
          type?: Database["public"]["Enums"]["content_type"] | null
          workspace_id: string
        }
        Update: {
          ancestor_ids?: string[]
          archived_at?: string | null
          created_at?: string
          created_by?: string
          due_at?: string | null
          id?: string
          notes?: string | null
          parent_id?: string | null
          platforms?: Database["public"]["Enums"]["platform"][]
          position?: string
          publish_at?: string | null
          source_end_ms?: number | null
          source_start_ms?: number | null
          stage_id?: string
          title?: string
          type?: Database["public"]["Enums"]["content_type"] | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_item_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: number
          payload: Json
          subject_id: string
          subject_type: string
          verb: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          subject_id: string
          subject_type: string
          verb: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: number
          payload?: Json
          subject_id?: string
          subject_type?: string
          verb?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_grants: {
        Row: {
          content_item_id: string
          created_at: string
          id: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string
          id?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content_item_id?: string
          created_at?: string
          id?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_grants_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_item_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_grants_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_grants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          leased_until: string | null
          payload: Json
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          workspace_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          kind: string
          last_error?: string | null
          leased_until?: string | null
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          workspace_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          kind?: string
          last_error?: string | null
          leased_until?: string | null
          payload?: Json
          run_after?: string
          status?: Database["public"]["Enums"]["job_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          accent: string | null
          created_at: string
          id: string
          name: string
          position: number
          workspace_id: string
        }
        Insert: {
          accent?: string | null
          created_at?: string
          id?: string
          name: string
          position: number
          workspace_id: string
        }
        Update: {
          accent?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          seat_limit: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          seat_limit?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          seat_limit?: number
        }
        Relationships: []
      }
    }
    Views: {
      content_item_status: {
        Row: {
          approval_state: Database["public"]["Enums"]["approval_state"] | null
          id: string | null
          latest_version_id: string | null
          workspace_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_version: {
        Args: { p_note?: string; p_version_id: string }
        Returns: {
          approval_state: Database["public"]["Enums"]["approval_state"]
          asset_id: string
          body: string | null
          created_at: string
          created_by: string
          drive_file_id: string | null
          id: string
          storage_path: string | null
          version_number: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "asset_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      can_approve: { Args: { ws: string }; Returns: boolean }
      can_invite_guests: { Args: { ws: string }; Returns: boolean }
      can_manage_people: { Args: { ws: string }; Returns: boolean }
      can_publish: { Args: { ws: string }; Returns: boolean }
      can_read_item: {
        Args: { item: Database["public"]["Tables"]["content_items"]["Row"] }
        Returns: boolean
      }
      can_read_subject: {
        Args: { p_id: string; p_type: string }
        Returns: boolean
      }
      check_ancestor_integrity: {
        Args: never
        Returns: {
          expected: string[]
          id: string
          stored: string[]
        }[]
      }
      create_version: {
        Args: {
          p_asset_id: string
          p_body?: string
          p_drive_file_id?: string
          p_storage_path?: string
        }
        Returns: {
          approval_state: Database["public"]["Enums"]["approval_state"]
          asset_id: string
          body: string | null
          created_at: string
          created_by: string
          drive_file_id: string | null
          id: string
          storage_path: string | null
          version_number: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "asset_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_workspace: { Args: { name: string }; Returns: string }
      emit_event: {
        Args: {
          payload?: Json
          subject_id: string
          subject_type: string
          verb: string
          ws: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          roles: Database["public"]["Enums"]["workspace_role"][]
          ws: string
        }
        Returns: boolean
      }
      in_workspace: { Args: { ws: string }; Returns: boolean }
      is_staff: { Args: { ws: string }; Returns: boolean }
      lease_jobs: {
        Args: { batch?: number; kinds: string[]; lease_seconds?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          kind: string
          last_error: string | null
          leased_until: string | null
          payload: Json
          run_after: string
          status: Database["public"]["Enums"]["job_status"]
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      request_changes: {
        Args: { p_note: string; p_version_id: string }
        Returns: {
          approval_state: Database["public"]["Enums"]["approval_state"]
          asset_id: string
          body: string | null
          created_at: string
          created_by: string
          drive_file_id: string | null
          id: string
          storage_path: string | null
          version_number: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "asset_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_default_stages: { Args: { ws: string }; Returns: undefined }
    }
    Enums: {
      approval_state: "draft" | "in_review" | "changes_requested" | "approved"
      content_type:
        | "youtube_video"
        | "short"
        | "tiktok"
        | "reel"
        | "instagram_post"
        | "podcast"
        | "livestream"
        | "newsletter"
        | "thumbnail"
        | "sponsored"
      job_status: "queued" | "leased" | "done" | "failed" | "dead"
      platform: "youtube" | "tiktok" | "instagram" | "x" | "linkedin"
      workspace_role: "owner" | "admin" | "editor" | "guest"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      approval_state: ["draft", "in_review", "changes_requested", "approved"],
      content_type: [
        "youtube_video",
        "short",
        "tiktok",
        "reel",
        "instagram_post",
        "podcast",
        "livestream",
        "newsletter",
        "thumbnail",
        "sponsored",
      ],
      job_status: ["queued", "leased", "done", "failed", "dead"],
      platform: ["youtube", "tiktok", "instagram", "x", "linkedin"],
      workspace_role: ["owner", "admin", "editor", "guest"],
    },
  },
} as const
