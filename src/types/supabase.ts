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
      profiles: { // Updated profiles table definition V3.2 - Removed Composio fields
        Row: {
          id: string // UUID, references auth.users.id
          updated_at: string | null
          username: string | null
          full_name: string | null
          phone_number: string | null
          gemini_api_key: string | null
          xp: number | null
          badges: string[] | null
          // Removed: composio_mcp_url, linkedin_url, twitter_url, youtube_url
          // Removed: is_linkedin_authed, is_twitter_authed, is_youtube_authed
          // Removed: composio_api_key
        }
        Insert: {
          id: string // UUID, references auth.users.id
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          phone_number?: string | null
          gemini_api_key?: string | null
          xp?: number | null
          badges?: string[] | null
          // Removed: composio_mcp_url, linkedin_url, twitter_url, youtube_url
          // Removed: is_linkedin_authed, is_twitter_authed, is_youtube_authed
          // Removed: composio_api_key
        }
        Update: {
          id?: string // UUID, references auth.users.id
          updated_at?: string | null
          username?: string | null
          full_name?: string | null
          phone_number?: string | null
          gemini_api_key?: string | null
          xp?: number | null
          badges?: string[] | null
          // Removed: composio_mcp_url, linkedin_url, twitter_url, youtube_url
          // Removed: is_linkedin_authed, is_twitter_authed, is_youtube_authed
          // Removed: composio_api_key
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
      quotas: { // Unchanged
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
      // Removed tokens table as it was likely Composio related
      // Removed failed_requests table unless it's used for non-Composio errors
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_quota: { // Unchanged
        Args: {
          p_user_id: string
          p_increment_amount: number
        }
        Returns: number
      }
      get_remaining_quota: { // Unchanged
        Args: {
          p_user_id: string
        }
        Returns: number
      }
      get_user_profile: {
        Args: {
          p_user_id: string
        }
        Returns: { // Update return type to match updated profiles.Row V3.2 - Removed Composio fields
          id: string
          updated_at: string | null
          username: string | null
          full_name: string | null
          phone_number: string | null
          gemini_api_key: string | null
          xp: number | null
          badges: string[] | null
          // Removed: composio_mcp_url, linkedin_url, twitter_url, youtube_url
          // Removed: is_linkedin_authed, is_twitter_authed, is_youtube_authed
          // Removed: composio_api_key
        }[] // Ensure it returns an array
      }
       handle_profile_update: { // Unchanged
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

// Removed ComposioApp type as it's no longer needed
// export type ComposioApp = 'linkedin' | 'twitter' | 'youtube';
