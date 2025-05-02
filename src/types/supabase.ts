// src/types/supabase.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: { // Updated profiles table definition V3.1 - Removed composio_api_key
        Row: {
          id: string // UUID, references auth.users.id
          updated_at: string | null
          username: string | null
          full_name: string | null
          phone_number: string | null
          composio_mcp_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          youtube_url: string | null
          gemini_api_key: string | null
          is_linkedin_authed: boolean | null
          is_twitter_authed: boolean | null
          is_youtube_authed: boolean | null
          xp: number | null
          badges: string[] | null
          // composio_api_key: string | null // Removed Composio API key
        }
        Insert: {
          id: string // UUID, references auth.users.id
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          phone_number?: string | null
          composio_mcp_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          youtube_url?: string | null
          gemini_api_key?: string | null
          is_linkedin_authed?: boolean | null
          is_twitter_authed?: boolean | null
          is_youtube_authed?: boolean | null
          xp?: number | null
          badges?: string[] | null
          // composio_api_key?: string | null // Removed Composio API key
        }
        Update: {
          id?: string // UUID, references auth.users.id
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          phone_number?: string | null
          composio_mcp_url?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          youtube_url?: string | null
          gemini_api_key?: string | null
          is_linkedin_authed?: boolean | null
          is_twitter_authed?: boolean | null
          is_youtube_authed?: boolean | null
          xp?: number | null
          badges?: string[] | null
          // composio_api_key?: string | null // Removed Composio API key
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      quotas: {
        Row: {
          user_id: string
          request_count: number
          last_reset_at: string
          quota_limit: number
          created_at: string
          ip_address: string | null
        }
        Insert: {
          user_id: string
          request_count?: number
          last_reset_at?: string
          quota_limit?: number
          created_at?: string
          ip_address?: string | null
        }
        Update: {
          user_id?: string
          request_count?: number
          last_reset_at?: string
          quota_limit?: number
          created_at?: string
          ip_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      // Optional: Keep other tables if they exist and are needed
      tokens?: {
         Row: { access_token: string; created_at: string; expires_at: string | null; id: string; profile_metadata: Json | null; provider: string; refresh_token: string | null; user_id: string }
         Insert: { access_token: string; created_at?: string; expires_at?: string | null; id?: string; profile_metadata?: Json | null; provider: string; refresh_token?: string | null; user_id: string }
         Update: { access_token?: string; created_at?: string; expires_at?: string | null; id?: string; profile_metadata?: Json | null; provider?: string; refresh_token?: string | null; user_id?: string }
         Relationships: [ { foreignKeyName: "tokens_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] } ]
      }
      failed_requests?: {
         Row: { id: string; user_id: string | null; created_at: string; request_type: string; error_message: string; request_payload: Json | null }
         Insert: { id?: string; user_id?: string | null; created_at?: string; request_type: string; error_message: string; request_payload?: Json | null }
         Update: { id?: string; user_id?: string | null; created_at?: string; request_type?: string; error_message?: string; request_payload?: Json | null }
         Relationships: [ { foreignKeyName: "failed_requests_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] } ]
       }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_quota: {
        Args: {
          p_user_id: string
          p_increment_amount: number
        }
        Returns: number
      }
      get_remaining_quota: {
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      get_user_profile: {
        Args: {
          p_user_id: string
        }
        Returns: { // Update return type to match updated profiles.Row V3.1 - Removed composio_api_key
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          phone_number: string | null
          composio_mcp_url: string | null
          linkedin_url: string | null
          twitter_url: string | null
          youtube_url: string | null
          gemini_api_key: string | null
          is_linkedin_authed: boolean | null
          is_twitter_authed: boolean | null
          is_youtube_authed: boolean | null
          xp: number | null
          badges: string[] | null
          // composio_api_key: string | null // Removed Composio API key
        }[] // Ensure it returns an array
      }
       handle_profile_update: { // Added definition for the trigger function if needed
         Args: Record<string, unknown>
         Returns: unknown // Typically returns TRIGGER
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

// Helper types remain the same
export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

// Define specific table row types for easier usage
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Quota = Database['public']['Tables']['quotas']['Row'];

// Define specific type for the return of get_user_profile function
// It returns an array, so we take the first element or define it as potentially undefined/null
export type UserProfileFunctionReturn = Database['public']['Functions']['get_user_profile']['Returns'] extends (infer R)[] ? R : never;


// Define types for Composio app authentication status
export type ComposioApp = 'linkedin' | 'twitter' | 'youtube';
