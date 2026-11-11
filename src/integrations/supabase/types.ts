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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      recipe_screenshots: {
        Row: {
          created_at: string
          display_order: number
          id: string
          image_url: string
          kind: string | null
          recipe_id: string
          sha256: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          image_url: string
          kind?: string | null
          recipe_id: string
          sha256?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string
          kind?: string | null
          recipe_id?: string
          sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recipe_screenshots_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          }
        ]
      }
      recipes: {
        Row: {
          annualized_return: number | null
          algorithm: string
          algorithm_inputs: Json
          archived_at: string | null
          asset: string
          asset_class: string
          asset_accumulated: string | null
          backtesting_period: string | null
          buy_hold_pnl_percent: number | null
          dca_pnl_percent: number | null
          best_for: string | null
          display_number: number | null
          cagr: number | null
          cash_profit: number | null
          created_at: string
          current_version_id: string | null
          entry_trade: string | null
          exit_to_entry_proportion: number | null
          exit_trade: string | null
          focus: string
          goal: string
          id: string
          initial_capital: number | null
          name: string
          net_profit: string | null
          sell_above_cost_basis: boolean | null
          slug: string | null
          strategy_type: string
          time_frame: string | null
          time_horizon: string
          updated_at: string
        }
        Insert: {
          annualized_return?: number | null
          algorithm: string
          algorithm_inputs?: Json
          archived_at?: string | null
          asset: string
          asset_class?: string
          asset_accumulated?: string | null
          backtesting_period?: string | null
          buy_hold_pnl_percent?: number | null
          dca_pnl_percent?: number | null
          best_for?: string | null
          display_number?: number | null
          cagr?: number | null
          cash_profit?: number | null
          created_at?: string
          entry_trade?: string | null
          exit_to_entry_proportion?: number | null
          exit_trade?: string | null
          focus: string
          goal: string
          id?: string
          initial_capital?: number | null
          name: string
          net_profit?: string | null
          sell_above_cost_basis?: boolean | null
          strategy_type: string
          time_frame?: string | null
          time_horizon: string
          updated_at?: string
        }
        Update: {
          annualized_return?: number | null
          algorithm?: string
          algorithm_inputs?: Json
          archived_at?: string | null
          asset?: string
          asset_class?: string
          asset_accumulated?: string | null
          backtesting_period?: string | null
          buy_hold_pnl_percent?: number | null
          dca_pnl_percent?: number | null
          best_for?: string | null
          display_number?: number | null
          cagr?: number | null
          cash_profit?: number | null
          created_at?: string
          entry_trade?: string | null
          exit_to_entry_proportion?: number | null
          exit_trade?: string | null
          focus?: string
          goal?: string
          id?: string
          initial_capital?: number | null
          name?: string
          net_profit?: string | null
          sell_above_cost_basis?: boolean | null
          strategy_type?: string
          time_frame?: string | null
          time_horizon?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_extractions: {
        Row: {
          created_at: string | null
          created_by: string | null
          cross_check: Json | null
          id: string | null
          images: Json | null
          last_bar_date: string | null
          model: string | null
          parsed: Json | null
          prompt_version: string | null
          provider: string | null
          raw_output: string | null
          schema_errors: Json | null
          strategy_id: string | null
          warnings: Json | null
        }
        Relationships: []
      }
      admin_parity_runs: {
        Row: {
          counts: Json | null
          id: number | null
          ok: boolean | null
          problems: Json | null
          ran_at: string | null
          trigger: string | null
        }
        Relationships: []
      }
      admin_strategy_versions: {
        Row: {
          acknowledged_checks: string[] | null
          algorithm: string | null
          algorithm_inputs: Json | null
          annualized_return: number | null
          approved_by: string | null
          archived_at: string | null
          as_of: string | null
          asset: string | null
          asset_accumulated_text: string | null
          asset_class: string | null
          asset_qty: number | null
          asset_unit: string | null
          backtesting_period_text: string | null
          basis: string | null
          benchmark_shown: string | null
          best_for: string | null
          buy_hold_pnl_pct: number | null
          cagr_pct: number | null
          cash_profit_usd: number | null
          change_note: string | null
          change_type: string | null
          checks: Json | null
          created_at: string | null
          created_by: string | null
          data_source: string | null
          dca_pnl_pct: number | null
          display_number: number | null
          down_market_behavior: string | null
          ending_value_usd: number | null
          entry_trade: string | null
          exit_to_entry_proportion: number | null
          exit_trade: string | null
          extraction_id: string | null
          fees_slippage: string | null
          focus: string | null
          goal: string | null
          how_it_trades: string | null
          id: string | null
          is_current: boolean | null
          legacy_cagr: number | null
          listed_public: boolean | null
          max_drawdown_pct: number | null
          name: string | null
          net_profit_text: string | null
          net_profit_usd: number | null
          public_chart_url: string | null
          published_at: string | null
          restored_from: string | null
          return_pct: number | null
          screenshots: Json | null
          sell_above_cost_basis: boolean | null
          short_name: string | null
          slug: string | null
          starting_capital: number | null
          status: string | null
          strategy_id: string | null
          strategy_type: string | null
          submitted_at: string | null
          submitted_by: string | null
          superseded_at: string | null
          test_end: string | null
          test_end_source: string | null
          test_start: string | null
          test_years: number | null
          time_frame: string | null
          time_horizon: string | null
          title: string | null
          up_market_behavior: string | null
          updated_at: string | null
          version_number: number | null
          vs_buy_hold_pct: number | null
          vs_dca_pct: number | null
        }
        Relationships: []
      }
      strategies_pro: {
        Row: {
          algorithm: string | null
          algorithm_inputs: Json | null
          archived_at: string | null
          as_of: string | null
          asset: string | null
          asset_class: string | null
          asset_qty: number | null
          asset_unit: string | null
          basis: string | null
          benchmark_shown: string | null
          best_for: string | null
          buy_hold_pnl_pct: number | null
          cagr_pct: number | null
          cash_profit_usd: number | null
          change_note: string | null
          change_type: string | null
          data_source: string | null
          dca_pnl_pct: number | null
          display_number: number | null
          down_market_behavior: string | null
          ending_value_usd: number | null
          entry_trade: string | null
          exit_to_entry_proportion: number | null
          exit_trade: string | null
          fees_slippage: string | null
          focus: string | null
          goal: string | null
          how_it_trades: string | null
          id: string | null
          max_drawdown_pct: number | null
          name: string | null
          net_profit_usd: number | null
          public_chart_url: string | null
          published_at: string | null
          return_pct: number | null
          screenshots: Json | null
          sell_above_cost_basis: boolean | null
          short_name: string | null
          slug: string | null
          starting_capital: number | null
          strategy_created_at: string | null
          strategy_type: string | null
          test_end: string | null
          test_start: string | null
          test_years: number | null
          time_frame: string | null
          time_horizon: string | null
          title: string | null
          up_market_behavior: string | null
          version_id: string | null
          version_number: number | null
          vs_buy_hold_pct: number | null
          vs_dca_pct: number | null
        }
        Relationships: []
      }
      strategies_public: {
        Row: {
          algorithm: string | null
          as_of: string | null
          asset: string | null
          asset_class: string | null
          asset_qty: number | null
          asset_unit: string | null
          basis: string | null
          benchmark_shown: string | null
          best_for: string | null
          buy_hold_pnl_pct: number | null
          cagr_pct: number | null
          cash_profit_usd: number | null
          data_source: string | null
          dca_pnl_pct: number | null
          display_number: number | null
          down_market_behavior: string | null
          ending_value_usd: number | null
          fees_slippage: string | null
          focus: string | null
          goal: string | null
          how_it_trades: string | null
          id: string | null
          max_drawdown_pct: number | null
          net_profit_usd: number | null
          public_chart_url: string | null
          return_pct: number | null
          short_name: string | null
          slug: string | null
          starting_capital: number | null
          strategy_type: string | null
          test_end: string | null
          test_start: string | null
          test_years: number | null
          time_frame: string | null
          time_horizon: string | null
          title: string | null
          up_market_behavior: string | null
          version_id: string | null
          version_number: number | null
          vs_buy_hold_pct: number | null
          vs_dca_pct: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_discard_draft: { Args: { p_version: string }; Returns: undefined }
      admin_email: { Args: Record<PropertyKey, never>; Returns: string | null }
      admin_publish: {
        Args: { p_acknowledged?: string[]; p_version: string }
        Returns: Json
      }
      admin_record_extraction: {
        Args: {
          p_cross_check: Json
          p_images: Json
          p_last_bar_date: string | null
          p_model: string
          p_parsed: Json
          p_prompt_version: string
          p_provider: string
          p_raw_output: string
          p_schema_errors: Json
          p_strategy: string | null
          p_warnings: Json
        }
        Returns: string
      }
      admin_refresh_draft_screenshots: { Args: { p_version: string }; Returns: undefined }
      admin_restore: { Args: { p_version: string }; Returns: string }
      admin_role: { Args: Record<PropertyKey, never>; Returns: string | null }
      admin_save_draft: { Args: { p_fields: Json; p_strategy: string | null }; Returns: string }
      admin_set_archived: { Args: { p_archived: boolean; p_strategy: string }; Returns: undefined }
      admin_submit_for_review: { Args: { p_version: string }; Returns: Json }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      run_parity_check: { Args: { p_trigger?: string }; Returns: Json }
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
