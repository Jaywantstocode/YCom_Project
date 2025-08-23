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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      action_logs: {
        Row: {
          created_at: string | null
          details: Json | null
          embedding: string | null
          ended_at: string | null
          id: string
          parent_id: string | null
          source_log_ids: string[] | null
          started_at: string
          summary: string | null
          tags: string[] | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          embedding?: string | null
          ended_at?: string | null
          id?: string
          parent_id?: string | null
          source_log_ids?: string[] | null
          started_at?: string
          summary?: string | null
          tags?: string[] | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          embedding?: string | null
          ended_at?: string | null
          id?: string
          parent_id?: string | null
          source_log_ids?: string[] | null
          started_at?: string
          summary?: string | null
          tags?: string[] | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_logs_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "action_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      images: {
        Row: {
          action_log_id: string | null
          captured_at: string
          created_at: string | null
          height: number | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          action_log_id?: string | null
          captured_at: string
          created_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          action_log_id?: string | null
          captured_at?: string
          created_at?: string | null
          height?: number | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "images_action_log_id_fkey"
            columns: ["action_log_id"]
            isOneToOne: true
            referencedRelation: "action_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          id: string
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          role?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          created_at: string | null
          id: string
          log_summary_id: string
          rationale: string | null
          score: number | null
          tool_title: string | null
          tool_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          log_summary_id: string
          rationale?: string | null
          score?: number | null
          tool_title?: string | null
          tool_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          log_summary_id?: string
          rationale?: string | null
          score?: number | null
          tool_title?: string | null
          tool_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_log_summary_id_fkey"
            columns: ["log_summary_id"]
            isOneToOne: false
            referencedRelation: "action_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_knowledge: {
        Row: {
          content: string | null
          created_at: string | null
          embedding: string | null
          id: string
          tags: string[] | null
          title: string | null
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          tags?: string[] | null
          title?: string | null
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          tags?: string[] | null
          title?: string | null
          url?: string | null
        }
        Relationships: []
      }
      log_summary: {
        Row: {
          id: string
          user_id: string
          action_log_id: string | null
          summary_text: string
          structured: Json | null
          tags: string[] | null
          embedding: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          action_log_id?: string | null
          summary_text: string
          structured?: Json | null
          tags?: string[] | null
          embedding?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          action_log_id?: string | null
          summary_text?: string
          structured?: Json | null
          tags?: string[] | null
          embedding?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      videos: {
        Row: {
          action_log_id: string | null
          captured_at: string
          created_at: string | null
          duration_seconds: number | null
          id: string
          mime_type: string | null
          resolution: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          action_log_id?: string | null
          captured_at: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          mime_type?: string | null
          resolution?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          action_log_id?: string | null
          captured_at?: string
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          mime_type?: string | null
          resolution?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "videos_action_log_id_fkey"
            columns: ["action_log_id"]
            isOneToOne: false
            referencedRelation: "action_logs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      get_similar_tool_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          source_id: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          similarity: number
          tags: string[]
          title: string
          url: string
        }[]
      }
      halfvec_avg: {
        Args: { "": number[] }
        Returns: unknown
      }
      halfvec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      halfvec_send: {
        Args: { "": unknown }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      hnsw_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      hnswhandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: { "": unknown }
        Returns: unknown
      }
      ivfflathandler: {
        Args: { "": unknown }
        Returns: unknown
      }
      l2_norm: {
        Args: { "": unknown } | { "": unknown }
        Returns: number
      }
      l2_normalize: {
        Args: { "": string } | { "": unknown } | { "": unknown }
        Returns: unknown
      }
      search_log_summary_semantic: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          user_id_filter: string
        }
        Returns: {
          action_log_id: string
          created_at: string
          id: string
          similarity: number
          structured: Json
          summary_text: string
          tags: string[]
          user_id: string
        }[]
      }
      search_tool_knowledge_hybrid: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          search_type: string
          similarity: number
          tags: string[]
          title: string
          url: string
        }[]
      }
      search_tool_knowledge_semantic: {
        Args: {
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          similarity: number
          tags: string[]
          title: string
          url: string
        }[]
      }
      sparsevec_out: {
        Args: { "": unknown }
        Returns: unknown
      }
      sparsevec_send: {
        Args: { "": unknown }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
      }
      vector_avg: {
        Args: { "": number[] }
        Returns: string
      }
      vector_dims: {
        Args: { "": string } | { "": unknown }
        Returns: number
      }
      vector_norm: {
        Args: { "": string }
        Returns: number
      }
      vector_out: {
        Args: { "": string }
        Returns: unknown
      }
      vector_send: {
        Args: { "": string }
        Returns: string
      }
      vector_typmod_in: {
        Args: { "": unknown[] }
        Returns: number
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
    Enums: {},
  },
} as const
