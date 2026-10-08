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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_error_logs: {
        Row: {
          context: Json
          created_at: string
          id: string
          message: string
          route: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          message: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          message?: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      approval_requests: {
        Row: {
          approval_reason: string | null
          approved_by: string | null
          created_at: string
          expires_at: string
          id: string
          operation_details: Json
          rejection_reason: string | null
          requested_by: string
          requested_operation: string
          status: string
          target_resource_id: string | null
          target_resource_type: string
          updated_at: string
        }
        Insert: {
          approval_reason?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          operation_details: Json
          rejection_reason?: string | null
          requested_by: string
          requested_operation: string
          status?: string
          target_resource_id?: string | null
          target_resource_type: string
          updated_at?: string
        }
        Update: {
          approval_reason?: string | null
          approved_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          operation_details?: Json
          rejection_reason?: string | null
          requested_by?: string
          requested_operation?: string
          status?: string
          target_resource_id?: string | null
          target_resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          operation: string
          resource_id: string | null
          resource_type: string
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation: string
          resource_id?: string | null
          resource_type: string
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          operation?: string
          resource_id?: string | null
          resource_type?: string
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: []
      }
      bank_account_closings: {
        Row: {
          bank_account_id: string
          closed_by: string | null
          closed_through: string
          closing_balance: number
          created_at: string
          id: string
          notes: string | null
        }
        Insert: {
          bank_account_id: string
          closed_by?: string | null
          closed_through: string
          closing_balance?: number
          created_at?: string
          id?: string
          notes?: string | null
        }
        Update: {
          bank_account_id?: string
          closed_by?: string | null
          closed_through?: string
          closing_balance?: number
          created_at?: string
          id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_closings_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_number: string | null
          account_type: string | null
          agency: string | null
          balance: number | null
          bank_name: string | null
          created_at: string | null
          current_balance: number | null
          id: string
          initial_balance: number | null
          is_active: boolean | null
          name: string
          pluggy_account_id: string | null
          pluggy_item_id: string | null
          updated_at: string | null
        }
        Insert: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          balance?: number | null
          bank_name?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          name: string
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          updated_at?: string | null
        }
        Update: {
          account_number?: string | null
          account_type?: string | null
          agency?: string | null
          balance?: number | null
          bank_name?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          initial_balance?: number | null
          is_active?: boolean | null
          name?: string
          pluggy_account_id?: string | null
          pluggy_item_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bank_card_transactions: {
        Row: {
          amount: number
          card_id: string
          category: string | null
          created_at: string
          description: string
          id: string
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          card_id: string
          category?: string | null
          created_at?: string
          description: string
          id?: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          card_id?: string
          category?: string | null
          created_at?: string
          description?: string
          id?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_card_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "bank_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_cards: {
        Row: {
          available_limit: number | null
          bank: string
          card_number: string
          card_type: string
          closing_date: number | null
          created_at: string
          created_by: string | null
          current_balance: number
          due_date: number | null
          id: string
          is_active: boolean
          limit_amount: number | null
          name: string
          updated_at: string
        }
        Insert: {
          available_limit?: number | null
          bank: string
          card_number: string
          card_type: string
          closing_date?: number | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          due_date?: number | null
          id?: string
          is_active?: boolean
          limit_amount?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          available_limit?: number | null
          bank?: string
          card_number?: string
          card_type?: string
          closing_date?: number | null
          created_at?: string
          created_by?: string | null
          current_balance?: number
          due_date?: number | null
          id?: string
          is_active?: boolean
          limit_amount?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bank_transaction_reconciliations: {
        Row: {
          bank_transaction_id: string
          created_at: string
          id: string
          notes: string | null
          reconciled_by: string | null
          updated_at: string
        }
        Insert: {
          bank_transaction_id: string
          created_at?: string
          id?: string
          notes?: string | null
          reconciled_by?: string | null
          updated_at?: string
        }
        Update: {
          bank_transaction_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          reconciled_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transaction_reconciliations_bank_transaction_id_fkey"
            columns: ["bank_transaction_id"]
            isOneToOne: true
            referencedRelation: "bank_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string | null
          category: string | null
          created_at: string | null
          description: string
          id: string
          import_fingerprint: string | null
          notes: string | null
          pluggy_transaction_id: string | null
          receipt_url: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id?: string | null
          category?: string | null
          created_at?: string | null
          description: string
          id?: string
          import_fingerprint?: string | null
          notes?: string | null
          pluggy_transaction_id?: string | null
          receipt_url?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string
          id?: string
          import_fingerprint?: string | null
          notes?: string | null
          pluggy_transaction_id?: string | null
          receipt_url?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      client_advances: {
        Row: {
          advance_date: string
          amount: number
          client_id: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          advance_date?: string
          amount?: number
          client_id: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_advances_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_custom_items: {
        Row: {
          client_id: string
          created_at: string
          description: string
          fabrication_date: string
          id: string
          notes: string | null
          quantity: number
          total_price: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description: string
          fabrication_date?: string
          id?: string
          notes?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string
          fabrication_date?: string
          id?: string
          notes?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_custom_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      collaborator_advances: {
        Row: {
          advance_date: string
          amount: number
          bank_account_id: string | null
          collaborator_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_advances_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_expense_advances: {
        Row: {
          advance_date: string
          amount: number
          bank_account_id: string | null
          collaborator_id: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_expense_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_expense_advances_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_food_allowances: {
        Row: {
          allowance_date: string
          allowance_type: string | null
          amount: number
          bank_account_id: string | null
          collaborator_id: string
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          allowance_date?: string
          allowance_type?: string | null
          amount?: number
          bank_account_id?: string | null
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          allowance_date?: string
          allowance_type?: string | null
          amount?: number
          bank_account_id?: string | null
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_food_allowances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_food_allowances_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_food_allowances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_monthly_salaries: {
        Row: {
          bank_account_id: string | null
          collaborator_id: string
          created_at: string
          created_by: string | null
          id: string
          is_paid: boolean
          payment_date: string | null
          salary_amount: number
          salary_month: number
          salary_year: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          collaborator_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_paid?: boolean
          payment_date?: string | null
          salary_amount?: number
          salary_month: number
          salary_year: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          collaborator_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_paid?: boolean
          payment_date?: string | null
          salary_amount?: number
          salary_month?: number
          salary_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_monthly_salaries_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_monthly_salaries_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborator_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          collaborator_id: string | null
          created_at: string | null
          event_id: string | null
          id: string
          is_paid: boolean | null
          notes: string | null
          payment_date: string
          payment_method: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          payment_date: string
          payment_method?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          collaborator_id?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaborator_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_payments_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collaborator_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          bank_account: string | null
          birth_date: string | null
          created_at: string | null
          created_by: string | null
          default_daily_rate: number | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string
          id: string
          internal_notes: string | null
          name: string
          notes: string | null
          phone: string | null
          photo_url: string | null
          pix_key: string | null
          role: string | null
          secondary_roles: string[]
          shoe_size: string | null
          skills: string[]
          social_name: string | null
          status: string | null
          status_reason: string | null
          uniform_size: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_account?: string | null
          birth_date?: string | null
          created_at?: string | null
          created_by?: string | null
          default_daily_rate?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string
          id?: string
          internal_notes?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          role?: string | null
          secondary_roles?: string[]
          shoe_size?: string | null
          skills?: string[]
          social_name?: string | null
          status?: string | null
          status_reason?: string | null
          uniform_size?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          bank_account?: string | null
          birth_date?: string | null
          created_at?: string | null
          created_by?: string | null
          default_daily_rate?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string
          id?: string
          internal_notes?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          pix_key?: string | null
          role?: string | null
          secondary_roles?: string[]
          shoe_size?: string | null
          skills?: string[]
          social_name?: string | null
          status?: string | null
          status_reason?: string | null
          uniform_size?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      company_expenses: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string
          expense_bank_account: string | null
          expense_date: string | null
          id: string
          is_paid: boolean | null
          notes: string | null
          payment_bank_account: string | null
          payment_date: string | null
          quantity: number | null
          receipt_url: string | null
          supplier: string | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          expense_bank_account?: string | null
          expense_date?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          payment_bank_account?: string | null
          payment_date?: string | null
          quantity?: number | null
          receipt_url?: string | null
          supplier?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          expense_bank_account?: string | null
          expense_date?: string | null
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          payment_bank_account?: string | null
          payment_date?: string | null
          quantity?: number | null
          receipt_url?: string | null
          supplier?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_fixed_expense_monthly_payments: {
        Row: {
          bank_account_id: string | null
          category: string
          company_fixed_expense_id: string
          created_at: string
          created_by: string | null
          id: string
          payment_amount: number
          payment_date: string
          payment_month: number
          payment_year: number
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          category: string
          company_fixed_expense_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          payment_amount?: number
          payment_date: string
          payment_month: number
          payment_year: number
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          category?: string
          company_fixed_expense_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payment_amount?: number
          payment_date?: string
          payment_month?: number
          payment_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_fixed_expense_monthly_pay_company_fixed_expense_id_fkey"
            columns: ["company_fixed_expense_id"]
            isOneToOne: false
            referencedRelation: "company_fixed_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_fixed_expense_monthly_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      company_fixed_expenses: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          monthly_amount: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          monthly_amount?: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          monthly_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj: string | null
          company_name: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          tagline: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          company_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          tagline?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      contract_attachments: {
        Row: {
          contract_id: string | null
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_attachments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          changes: Json | null
          contract_id: string
          created_at: string
          from_status: string | null
          id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          contract_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          changes?: Json | null
          contract_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_payments: {
        Row: {
          contract_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          payment_amount: number
          payment_date: string
          payment_method: string | null
          payment_status: string | null
          updated_at: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_amount: number
          payment_date: string
          payment_method?: string | null
          payment_status?: string | null
          updated_at?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_amount?: number
          payment_date?: string
          payment_method?: string | null
          payment_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_payments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          sections: Json
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sections?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sections?: Json
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      contracts: {
        Row: {
          cancelled_at: string | null
          client_document: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          contract_number: string
          created_at: string | null
          created_by: string | null
          details: Json | null
          end_date: string
          event_id: string | null
          id: string
          locked: boolean
          payment_terms: string | null
          quote_id: string | null
          sections_snapshot: Json | null
          sent_at: string | null
          service_description: string
          signed_at: string | null
          source_quote_number: string | null
          start_date: string
          status: string | null
          template_id: string | null
          template_name: string | null
          template_version: number | null
          total_value: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          cancelled_at?: string | null
          client_document?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          contract_number: string
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          end_date: string
          event_id?: string | null
          id?: string
          locked?: boolean
          payment_terms?: string | null
          quote_id?: string | null
          sections_snapshot?: Json | null
          sent_at?: string | null
          service_description: string
          signed_at?: string | null
          source_quote_number?: string | null
          start_date: string
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
          total_value?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          cancelled_at?: string | null
          client_document?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          contract_number?: string
          created_at?: string | null
          created_by?: string | null
          details?: Json | null
          end_date?: string
          event_id?: string | null
          id?: string
          locked?: boolean
          payment_terms?: string | null
          quote_id?: string | null
          sections_snapshot?: Json | null
          sent_at?: string | null
          service_description?: string
          signed_at?: string | null
          source_quote_number?: string | null
          start_date?: string
          status?: string | null
          template_id?: string | null
          template_name?: string | null
          template_version?: number | null
          total_value?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      daily_rates: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          amount: number
          attendance_status: string
          bank_account_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          discount_amount: number
          event_id: string | null
          event_role: string | null
          food_amount: number
          id: string
          is_finalized: boolean | null
          lodging_amount: number
          notes: string | null
          overtime_amount: number
          payment_method: string | null
          payment_status: string
          planned_end_time: string | null
          planned_start_time: string | null
          receipt_url: string | null
          substituted_worker_name: string | null
          transport_amount: number
          updated_at: string | null
          worker_id: string | null
          worker_name: string
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          amount: number
          attendance_status?: string
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          discount_amount?: number
          event_id?: string | null
          event_role?: string | null
          food_amount?: number
          id?: string
          is_finalized?: boolean | null
          lodging_amount?: number
          notes?: string | null
          overtime_amount?: number
          payment_method?: string | null
          payment_status?: string
          planned_end_time?: string | null
          planned_start_time?: string | null
          receipt_url?: string | null
          substituted_worker_name?: string | null
          transport_amount?: number
          updated_at?: string | null
          worker_id?: string | null
          worker_name: string
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          amount?: number
          attendance_status?: string
          bank_account_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          discount_amount?: number
          event_id?: string | null
          event_role?: string | null
          food_amount?: number
          id?: string
          is_finalized?: boolean | null
          lodging_amount?: number
          notes?: string | null
          overtime_amount?: number
          payment_method?: string | null
          payment_status?: string
          planned_end_time?: string | null
          planned_start_time?: string | null
          receipt_url?: string | null
          substituted_worker_name?: string | null
          transport_amount?: number
          updated_at?: string | null
          worker_id?: string | null
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_rates_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_rates_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          available: number | null
          budget_pdf_url: string | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          price_per_day: number | null
          rented: number | null
          status: string | null
          total_stock: number | null
          updated_at: string | null
        }
        Insert: {
          available?: number | null
          budget_pdf_url?: string | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          price_per_day?: number | null
          rented?: number | null
          status?: string | null
          total_stock?: number | null
          updated_at?: string | null
        }
        Update: {
          available?: number | null
          budget_pdf_url?: string | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          price_per_day?: number | null
          rented?: number | null
          status?: string | null
          total_stock?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      event_budgets: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          event_id: string | null
          id: string
          image_url: string | null
          item: string
          pdf_url: string | null
          quantity: number | null
          source_item_id: string | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          item: string
          pdf_url?: string | null
          quantity?: number | null
          source_item_id?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_id?: string | null
          id?: string
          image_url?: string | null
          item?: string
          pdf_url?: string | null
          quantity?: number | null
          source_item_id?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_budgets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checklist_items: {
        Row: {
          checked_quantity: number
          checklist_id: string
          created_at: string
          equipment_id: string | null
          equipment_name: string
          expected_quantity: number
          id: string
          is_checked: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          checked_quantity?: number
          checklist_id: string
          created_at?: string
          equipment_id?: string | null
          equipment_name: string
          expected_quantity?: number
          id?: string
          is_checked?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          checked_quantity?: number
          checklist_id?: string
          created_at?: string
          equipment_id?: string | null
          equipment_name?: string
          expected_quantity?: number
          id?: string
          is_checked?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "event_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_items_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checklists: {
        Row: {
          created_at: string
          created_by: string | null
          event_id: string
          id: string
          notes: string | null
          performed_at: string | null
          phase: string
          responsible_name: string | null
          responsible_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_id: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          phase: string
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          phase?: string
          responsible_name?: string | null
          responsible_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_checklists_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_collaborators: {
        Row: {
          assigned_by: string | null
          collaborator_email: string
          collaborator_id: string | null
          collaborator_name: string
          created_at: string
          event_id: string
          id: string
          person_type: string | null
          reference_id: string | null
          reference_type: string | null
          role: string
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          assigned_by?: string | null
          collaborator_email?: string
          collaborator_id?: string | null
          collaborator_name: string
          created_at?: string
          event_id: string
          id?: string
          person_type?: string | null
          reference_id?: string | null
          reference_type?: string | null
          role?: string
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          assigned_by?: string | null
          collaborator_email?: string
          collaborator_id?: string | null
          collaborator_name?: string
          created_at?: string
          event_id?: string
          id?: string
          person_type?: string | null
          reference_id?: string | null
          reference_type?: string | null
          role?: string
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_collaborators_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_collaborators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_collaborators_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contracts: {
        Row: {
          additional_terms: string | null
          budget_number: string | null
          cancellation_policy: string | null
          client_address: string | null
          client_document: string | null
          client_email: string | null
          client_name: string
          client_phone: string | null
          client_signature: string | null
          company_address: string | null
          company_document: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          company_signature: string | null
          contract_number: string
          created_at: string
          created_by: string | null
          decorator: string | null
          delivery_terms: string | null
          discount: number | null
          discount_rate: number | null
          event_date: string | null
          event_id: string | null
          event_location: string | null
          id: string
          initial_setup_date: string | null
          payment_terms: string | null
          products: Json | null
          service_description: string | null
          signed_at: string | null
          status: string
          subtotal: number | null
          tax: number | null
          tax_rate: number | null
          technical_responsible: string | null
          total: number | null
          updated_at: string
          warranty_terms: string | null
          with_discount: boolean | null
          with_tax: boolean | null
        }
        Insert: {
          additional_terms?: string | null
          budget_number?: string | null
          cancellation_policy?: string | null
          client_address?: string | null
          client_document?: string | null
          client_email?: string | null
          client_name: string
          client_phone?: string | null
          client_signature?: string | null
          company_address?: string | null
          company_document?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          company_signature?: string | null
          contract_number: string
          created_at?: string
          created_by?: string | null
          decorator?: string | null
          delivery_terms?: string | null
          discount?: number | null
          discount_rate?: number | null
          event_date?: string | null
          event_id?: string | null
          event_location?: string | null
          id?: string
          initial_setup_date?: string | null
          payment_terms?: string | null
          products?: Json | null
          service_description?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          technical_responsible?: string | null
          total?: number | null
          updated_at?: string
          warranty_terms?: string | null
          with_discount?: boolean | null
          with_tax?: boolean | null
        }
        Update: {
          additional_terms?: string | null
          budget_number?: string | null
          cancellation_policy?: string | null
          client_address?: string | null
          client_document?: string | null
          client_email?: string | null
          client_name?: string
          client_phone?: string | null
          client_signature?: string | null
          company_address?: string | null
          company_document?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          company_signature?: string | null
          contract_number?: string
          created_at?: string
          created_by?: string | null
          decorator?: string | null
          delivery_terms?: string | null
          discount?: number | null
          discount_rate?: number | null
          event_date?: string | null
          event_id?: string | null
          event_location?: string | null
          id?: string
          initial_setup_date?: string | null
          payment_terms?: string | null
          products?: Json | null
          service_description?: string | null
          signed_at?: string | null
          status?: string
          subtotal?: number | null
          tax?: number | null
          tax_rate?: number | null
          technical_responsible?: string | null
          total?: number | null
          updated_at?: string
          warranty_terms?: string | null
          with_discount?: boolean | null
          with_tax?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "event_contracts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_equipment: {
        Row: {
          assigned_by: string | null
          budget_pdf_url: string | null
          created_at: string
          description: string | null
          equipment_name: string
          event_id: string
          id: string
          image_url: string | null
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          budget_pdf_url?: string | null
          created_at?: string
          description?: string | null
          equipment_name: string
          event_id: string
          id?: string
          image_url?: string | null
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          budget_pdf_url?: string | null
          created_at?: string
          description?: string | null
          equipment_name?: string
          event_id?: string
          id?: string
          image_url?: string | null
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_equipment_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_expenses: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string
          event_id: string | null
          expense_bank_account: string | null
          expense_date: string | null
          id: string
          is_finalized: boolean
          is_paid: boolean | null
          notes: string | null
          payment_bank_account: string | null
          payment_date: string | null
          quantity: number | null
          receipt_url: string | null
          reference_id: string | null
          reference_type: string | null
          supplier: string | null
          total_price: number | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          event_id?: string | null
          expense_bank_account?: string | null
          expense_date?: string | null
          id?: string
          is_finalized?: boolean
          is_paid?: boolean | null
          notes?: string | null
          payment_bank_account?: string | null
          payment_date?: string | null
          quantity?: number | null
          receipt_url?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          event_id?: string | null
          expense_bank_account?: string | null
          expense_date?: string | null
          id?: string
          is_finalized?: boolean
          is_paid?: boolean | null
          notes?: string | null
          payment_bank_account?: string | null
          payment_date?: string | null
          quantity?: number | null
          receipt_url?: string | null
          reference_id?: string | null
          reference_type?: string | null
          supplier?: string | null
          total_price?: number | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          is_paid: boolean | null
          is_remaining_paid: boolean | null
          location: string | null
          name: string
          payment_amount: number | null
          payment_bank_account: string | null
          payment_date: string | null
          payment_type: string | null
          profit_margin: number | null
          remaining_payment_amount: number | null
          remaining_payment_bank_account: string | null
          remaining_payment_date: string | null
          setup_start_date: string | null
          status: string | null
          total_budget: number | null
          total_expenses: number | null
          updated_at: string | null
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          is_paid?: boolean | null
          is_remaining_paid?: boolean | null
          location?: string | null
          name: string
          payment_amount?: number | null
          payment_bank_account?: string | null
          payment_date?: string | null
          payment_type?: string | null
          profit_margin?: number | null
          remaining_payment_amount?: number | null
          remaining_payment_bank_account?: string | null
          remaining_payment_date?: string | null
          setup_start_date?: string | null
          status?: string | null
          total_budget?: number | null
          total_expenses?: number | null
          updated_at?: string | null
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          is_paid?: boolean | null
          is_remaining_paid?: boolean | null
          location?: string | null
          name?: string
          payment_amount?: number | null
          payment_bank_account?: string | null
          payment_date?: string | null
          payment_type?: string | null
          profit_margin?: number | null
          remaining_payment_amount?: number | null
          remaining_payment_bank_account?: string | null
          remaining_payment_date?: string | null
          setup_start_date?: string | null
          status?: string | null
          total_budget?: number | null
          total_expenses?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      external_quotes: {
        Row: {
          accommodation_expense: number | null
          client_address: string | null
          client_document: string | null
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          created_by: string | null
          decorator_name: string | null
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          event_date: string | null
          event_id: string | null
          event_location: string | null
          event_name: string | null
          id: string
          initial_setup_date: string | null
          items: Json | null
          notes: string | null
          products: Json | null
          quote_date: string
          quote_number: string | null
          status: string | null
          subtotal: number
          supplier_name: string | null
          tax_option: string | null
          tax_amount: number | null
          tax_percentage: number | null
          technical_responsible: string | null
          total_amount: number
          total_value: number | null
          travel_expense: number | null
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          accommodation_expense?: number | null
          client_address?: string | null
          client_document?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          decorator_name?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          event_date?: string | null
          event_id?: string | null
          event_location?: string | null
          event_name?: string | null
          id?: string
          initial_setup_date?: string | null
          items?: Json | null
          notes?: string | null
          products?: Json | null
          quote_date?: string
          quote_number?: string | null
          status?: string | null
          subtotal?: number
          supplier_name?: string | null
          tax_option?: string | null
          tax_amount?: number | null
          tax_percentage?: number | null
          technical_responsible?: string | null
          total_amount?: number
          total_value?: number | null
          travel_expense?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          accommodation_expense?: number | null
          client_address?: string | null
          client_document?: string | null
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          decorator_name?: string | null
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          event_date?: string | null
          event_id?: string | null
          event_location?: string | null
          event_name?: string | null
          id?: string
          initial_setup_date?: string | null
          items?: Json | null
          notes?: string | null
          products?: Json | null
          quote_date?: string
          quote_number?: string | null
          status?: string | null
          subtotal?: number
          supplier_name?: string | null
          tax_option?: string | null
          tax_amount?: number | null
          tax_percentage?: number | null
          technical_responsible?: string | null
          total_amount?: number
          total_value?: number | null
          travel_expense?: number | null
          updated_at?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_quotes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          notes: string | null
          number: number
          status: string
          title_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          number: number
          status?: string
          title_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          number?: number
          status?: string
          title_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_installments_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "finance_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          discount_amount: number
          fine_amount: number
          id: string
          installment_id: string | null
          interest_amount: number
          is_reversal: boolean
          method: string | null
          notes: string | null
          paid_at: string
          receipt_url: string | null
          reverses_payment_id: string | null
          title_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          fine_amount?: number
          id?: string
          installment_id?: string | null
          interest_amount?: number
          is_reversal?: boolean
          method?: string | null
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          reverses_payment_id?: string | null
          title_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          fine_amount?: number
          id?: string
          installment_id?: string | null
          interest_amount?: number
          is_reversal?: boolean
          method?: string | null
          notes?: string | null
          paid_at?: string
          receipt_url?: string | null
          reverses_payment_id?: string | null
          title_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "finance_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_reverses_payment_id_fkey"
            columns: ["reverses_payment_id"]
            isOneToOne: false
            referencedRelation: "finance_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "finance_titles"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_titles: {
        Row: {
          category: string | null
          client_id: string | null
          contract_id: string | null
          cost_center: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string
          event_id: string | null
          id: string
          issue_date: string
          kind: string
          notes: string | null
          quote_id: string | null
          source_id: string | null
          source_type: string | null
          status: string
          supplier_name: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          client_id?: string | null
          contract_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date: string
          event_id?: string | null
          id?: string
          issue_date?: string
          kind: string
          notes?: string | null
          quote_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_name?: string | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          client_id?: string | null
          contract_id?: string | null
          cost_center?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string
          event_id?: string | null
          id?: string
          issue_date?: string
          kind?: string
          notes?: string | null
          quote_id?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string
          supplier_name?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_document_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          document_id: string
          from_status: string | null
          id: string
          payload: Json
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          document_id: string
          from_status?: string | null
          id?: string
          payload?: Json
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          document_id?: string
          from_status?: string | null
          id?: string
          payload?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_document_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_document_items: {
        Row: {
          cfop: string | null
          created_at: string
          csosn: string | null
          cst: string | null
          description: string
          document_id: string
          extra: Json
          icms_rate: number | null
          id: string
          ipi_rate: number | null
          ncm: string | null
          quantity: number
          sequence: number
          total_cents: number
          unit: string
          unit_value_cents: number
          updated_at: string
        }
        Insert: {
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst?: string | null
          description: string
          document_id: string
          extra?: Json
          icms_rate?: number | null
          id?: string
          ipi_rate?: number | null
          ncm?: string | null
          quantity?: number
          sequence?: number
          total_cents?: number
          unit?: string
          unit_value_cents?: number
          updated_at?: string
        }
        Update: {
          cfop?: string | null
          created_at?: string
          csosn?: string | null
          cst?: string | null
          description?: string
          document_id?: string
          extra?: Json
          icms_rate?: number | null
          id?: string
          ipi_rate?: number | null
          ncm?: string | null
          quantity?: number
          sequence?: number
          total_cents?: number
          unit?: string
          unit_value_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_document_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_documents: {
        Row: {
          access_key: string | null
          authorization_source: string | null
          authorized_at: string | null
          created_at: string
          created_by: string | null
          delivery: Json
          driver: Json
          emitter: Json
          environment: string
          event_id: string | null
          id: string
          issue_date: string
          model: string
          notes: string | null
          number: string | null
          operation_nature: string | null
          pdf_path: string | null
          profile_id: string | null
          protocol_date: string | null
          protocol_number: string | null
          purpose: string
          receipt_number: string | null
          recipient: Json
          referenced_keys: string[]
          rejection_code: string | null
          rejection_message: string | null
          return_of_document_id: string | null
          route_states: string[]
          series: string
          source: string
          status: string
          total_document_cents: number
          total_products_cents: number
          totals: Json
          transport_id: string | null
          updated_at: string
          vehicle: Json
          xml_path: string | null
          xml_sha256: string | null
        }
        Insert: {
          access_key?: string | null
          authorization_source?: string | null
          authorized_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery?: Json
          driver?: Json
          emitter?: Json
          environment?: string
          event_id?: string | null
          id?: string
          issue_date?: string
          model?: string
          notes?: string | null
          number?: string | null
          operation_nature?: string | null
          pdf_path?: string | null
          profile_id?: string | null
          protocol_date?: string | null
          protocol_number?: string | null
          purpose?: string
          receipt_number?: string | null
          recipient?: Json
          referenced_keys?: string[]
          rejection_code?: string | null
          rejection_message?: string | null
          return_of_document_id?: string | null
          route_states?: string[]
          series?: string
          source?: string
          status?: string
          total_document_cents?: number
          total_products_cents?: number
          totals?: Json
          transport_id?: string | null
          updated_at?: string
          vehicle?: Json
          xml_path?: string | null
          xml_sha256?: string | null
        }
        Update: {
          access_key?: string | null
          authorization_source?: string | null
          authorized_at?: string | null
          created_at?: string
          created_by?: string | null
          delivery?: Json
          driver?: Json
          emitter?: Json
          environment?: string
          event_id?: string | null
          id?: string
          issue_date?: string
          model?: string
          notes?: string | null
          number?: string | null
          operation_nature?: string | null
          pdf_path?: string | null
          profile_id?: string | null
          protocol_date?: string | null
          protocol_number?: string | null
          purpose?: string
          receipt_number?: string | null
          recipient?: Json
          referenced_keys?: string[]
          rejection_code?: string | null
          rejection_message?: string | null
          return_of_document_id?: string | null
          route_states?: string[]
          series?: string
          source?: string
          status?: string
          total_document_cents?: number
          total_products_cents?: number
          totals?: Json
          transport_id?: string | null
          updated_at?: string
          vehicle?: Json
          xml_path?: string | null
          xml_sha256?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "fiscal_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_return_of_document_id_fkey"
            columns: ["return_of_document_id"]
            isOneToOne: false
            referencedRelation: "fiscal_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fiscal_documents_transport_id_fkey"
            columns: ["transport_id"]
            isOneToOne: false
            referencedRelation: "interstate_transports"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_profiles: {
        Row: {
          accountant_confirmed: boolean
          accountant_confirmed_at: string | null
          accountant_confirmed_by: string | null
          accountant_name: string | null
          created_at: string
          created_by: string | null
          default_cfop: string | null
          default_csosn: string | null
          default_cst: string | null
          default_ncm: string | null
          default_unit: string
          emitter: Json
          environment: string
          icms_rate: number | null
          id: string
          ipi_rate: number | null
          is_active: boolean
          model: string
          name: string
          notes: string | null
          operation_nature: string | null
          purpose: string | null
          tax_regime: string | null
          updated_at: string
        }
        Insert: {
          accountant_confirmed?: boolean
          accountant_confirmed_at?: string | null
          accountant_confirmed_by?: string | null
          accountant_name?: string | null
          created_at?: string
          created_by?: string | null
          default_cfop?: string | null
          default_csosn?: string | null
          default_cst?: string | null
          default_ncm?: string | null
          default_unit?: string
          emitter?: Json
          environment?: string
          icms_rate?: number | null
          id?: string
          ipi_rate?: number | null
          is_active?: boolean
          model?: string
          name: string
          notes?: string | null
          operation_nature?: string | null
          purpose?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Update: {
          accountant_confirmed?: boolean
          accountant_confirmed_at?: string | null
          accountant_confirmed_by?: string | null
          accountant_name?: string | null
          created_at?: string
          created_by?: string | null
          default_cfop?: string | null
          default_csosn?: string | null
          default_cst?: string | null
          default_ncm?: string | null
          default_unit?: string
          emitter?: Json
          environment?: string
          icms_rate?: number | null
          id?: string
          ipi_rate?: number | null
          is_active?: boolean
          model?: string
          name?: string
          notes?: string | null
          operation_nature?: string | null
          purpose?: string | null
          tax_regime?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      interstate_transports: {
        Row: {
          advance_cents: number
          arrival_date: string | null
          arrival_time: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cargo_type: string | null
          cargo_value: number | null
          cargo_weight: number | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          daily_rate_cents: number
          departure_time: string | null
          destination: string
          destination_state: string | null
          distance_km: number
          driver_cpf: string | null
          driver_name: string
          driver_phone: string | null
          equipment_list: Json | null
          estimated_cost: number | null
          event_id: string | null
          expected_return_date: string | null
          extra_cents: number
          freight_cents: number
          fuel_consumption_kmpl: number
          fuel_cost_cents: number
          fuel_price_cents: number
          helpers: Json
          id: string
          invoice_number: string | null
          legs: Json
          lodging_cents: number
          maintenance_cents: number
          material_list: Json | null
          meals_cents: number
          notes: string | null
          origin_city: string | null
          origin_state: string | null
          receipt_path: string | null
          return_date: string | null
          return_notes: string | null
          return_status: string | null
          revenue_cents: number
          status: string
          toll_cents: number
          total_weight: number | null
          transport_date: string
          updated_at: string
          vehicle_capacity_kg: number | null
          vehicle_model: string | null
          vehicle_plate: string
        }
        Insert: {
          advance_cents?: number
          arrival_date?: string | null
          arrival_time?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          cargo_weight?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate_cents?: number
          departure_time?: string | null
          destination: string
          destination_state?: string | null
          distance_km?: number
          driver_cpf?: string | null
          driver_name: string
          driver_phone?: string | null
          equipment_list?: Json | null
          estimated_cost?: number | null
          event_id?: string | null
          expected_return_date?: string | null
          extra_cents?: number
          freight_cents?: number
          fuel_consumption_kmpl?: number
          fuel_cost_cents?: number
          fuel_price_cents?: number
          helpers?: Json
          id?: string
          invoice_number?: string | null
          legs?: Json
          lodging_cents?: number
          maintenance_cents?: number
          material_list?: Json | null
          meals_cents?: number
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          receipt_path?: string | null
          return_date?: string | null
          return_notes?: string | null
          return_status?: string | null
          revenue_cents?: number
          status?: string
          toll_cents?: number
          total_weight?: number | null
          transport_date: string
          updated_at?: string
          vehicle_capacity_kg?: number | null
          vehicle_model?: string | null
          vehicle_plate: string
        }
        Update: {
          advance_cents?: number
          arrival_date?: string | null
          arrival_time?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cargo_type?: string | null
          cargo_value?: number | null
          cargo_weight?: number | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate_cents?: number
          departure_time?: string | null
          destination?: string
          destination_state?: string | null
          distance_km?: number
          driver_cpf?: string | null
          driver_name?: string
          driver_phone?: string | null
          equipment_list?: Json | null
          estimated_cost?: number | null
          event_id?: string | null
          expected_return_date?: string | null
          extra_cents?: number
          freight_cents?: number
          fuel_consumption_kmpl?: number
          fuel_cost_cents?: number
          fuel_price_cents?: number
          helpers?: Json
          id?: string
          invoice_number?: string | null
          legs?: Json
          lodging_cents?: number
          maintenance_cents?: number
          material_list?: Json | null
          meals_cents?: number
          notes?: string | null
          origin_city?: string | null
          origin_state?: string | null
          receipt_path?: string | null
          return_date?: string | null
          return_notes?: string | null
          return_status?: string | null
          revenue_cents?: number
          status?: string
          toll_cents?: number
          total_weight?: number | null
          transport_date?: string
          updated_at?: string
          vehicle_capacity_kg?: number | null
          vehicle_model?: string | null
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "interstate_transports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_records: {
        Row: {
          completed_date: string | null
          cost: number | null
          created_at: string | null
          created_by: string | null
          description: string
          equipment_id: string | null
          equipment_name: string
          id: string
          maintenance_type: string
          priority: string | null
          problem_description: string | null
          quantity: number | null
          scheduled_date: string
          solution_description: string | null
          status: string | null
          technician_contact: string | null
          technician_name: string | null
          updated_at: string | null
        }
        Insert: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description: string
          equipment_id?: string | null
          equipment_name: string
          id?: string
          maintenance_type: string
          priority?: string | null
          problem_description?: string | null
          quantity?: number | null
          scheduled_date: string
          solution_description?: string | null
          status?: string | null
          technician_contact?: string | null
          technician_name?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_date?: string | null
          cost?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          equipment_id?: string | null
          equipment_name?: string
          id?: string
          maintenance_type?: string
          priority?: string | null
          problem_description?: string | null
          quantity?: number | null
          scheduled_date?: string
          solution_description?: string | null
          status?: string | null
          technician_contact?: string | null
          technician_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_records_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      nfse_certificates: {
        Row: {
          certificate_name: string
          certificate_type: string | null
          created_at: string
          id: string
          is_active: boolean | null
          issuer: string | null
          storage_path: string | null
          subject_cn: string | null
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          certificate_name: string
          certificate_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          issuer?: string | null
          storage_path?: string | null
          subject_cn?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          certificate_name?: string
          certificate_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          issuer?: string | null
          storage_path?: string | null
          subject_cn?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      nfse_config: {
        Row: {
          abrasf_version: string | null
          active_certificate_id: string | null
          created_at: string
          default_cnae: string | null
          default_iss_rate: number | null
          default_service_code: string | null
          environment: string | null
          id: string
          is_configured: boolean | null
          iss_retention_default: boolean
          last_rps_number: number | null
          municipality_code: string
          municipality_name: string | null
          national_homologation_enabled: boolean
          national_registration_confirmed_at: string | null
          national_registration_status: string
          national_transmission_enabled: boolean
          provider_cnpj: string | null
          provider_im: string | null
          rps_series: string | null
          service_exigibility: number
          simple_national: boolean
          state: string | null
          updated_at: string
          webservice_url: string | null
          webservice_url_homolog: string | null
        }
        Insert: {
          abrasf_version?: string | null
          active_certificate_id?: string | null
          created_at?: string
          default_cnae?: string | null
          default_iss_rate?: number | null
          default_service_code?: string | null
          environment?: string | null
          id?: string
          is_configured?: boolean | null
          iss_retention_default?: boolean
          last_rps_number?: number | null
          municipality_code?: string
          municipality_name?: string | null
          national_homologation_enabled?: boolean
          national_registration_confirmed_at?: string | null
          national_registration_status?: string
          national_transmission_enabled?: boolean
          provider_cnpj?: string | null
          provider_im?: string | null
          rps_series?: string | null
          service_exigibility?: number
          simple_national?: boolean
          state?: string | null
          updated_at?: string
          webservice_url?: string | null
          webservice_url_homolog?: string | null
        }
        Update: {
          abrasf_version?: string | null
          active_certificate_id?: string | null
          created_at?: string
          default_cnae?: string | null
          default_iss_rate?: number | null
          default_service_code?: string | null
          environment?: string | null
          id?: string
          is_configured?: boolean | null
          iss_retention_default?: boolean
          last_rps_number?: number | null
          municipality_code?: string
          municipality_name?: string | null
          national_homologation_enabled?: boolean
          national_registration_confirmed_at?: string | null
          national_registration_status?: string
          national_transmission_enabled?: boolean
          provider_cnpj?: string | null
          provider_im?: string | null
          rps_series?: string | null
          service_exigibility?: number
          simple_national?: boolean
          state?: string | null
          updated_at?: string
          webservice_url?: string | null
          webservice_url_homolog?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_config_active_certificate_id_fkey"
            columns: ["active_certificate_id"]
            isOneToOne: false
            referencedRelation: "nfse_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      nfse_invoices: {
        Row: {
          authorized_at: string | null
          base_calculation: number
          cancelled_at: string | null
          cnae_code: string | null
          cofins_value: number | null
          competence_date: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          csll_value: number | null
          cultural_incentive: boolean | null
          deduction_value: number | null
          discount_conditioned: number | null
          discount_unconditioned: number | null
          error_code: string | null
          error_message: string | null
          event_id: string | null
          id: string
          inss_value: number | null
          invoice_number: string | null
          ir_value: number | null
          iss_rate: number | null
          iss_retention: boolean | null
          iss_retention_responsible: number | null
          iss_value: number
          issue_date: string
          nature_operation: number | null
          net_value: number
          nfse_link: string | null
          other_retentions: number | null
          pis_value: number | null
          protocol_number: string | null
          provider_address: string | null
          provider_city_code: string | null
          provider_cnpj: string
          provider_im: string | null
          provider_name: string
          provider_state: string | null
          quote_id: string | null
          rps_number: string
          rps_series: string | null
          rps_type: number | null
          service_code: string
          service_description: string
          service_value: number
          simple_national: boolean | null
          special_regime: number | null
          status: string
          taker_address: string | null
          taker_cep: string | null
          taker_city_code: string | null
          taker_document: string
          taker_email: string | null
          taker_name: string
          taker_phone: string | null
          taker_state: string | null
          taker_type: string | null
          transmitted_at: string | null
          updated_at: string
          verification_code: string | null
          xml_nfse: string | null
          xml_rps: string | null
        }
        Insert: {
          authorized_at?: string | null
          base_calculation: number
          cancelled_at?: string | null
          cnae_code?: string | null
          cofins_value?: number | null
          competence_date?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          csll_value?: number | null
          cultural_incentive?: boolean | null
          deduction_value?: number | null
          discount_conditioned?: number | null
          discount_unconditioned?: number | null
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          inss_value?: number | null
          invoice_number?: string | null
          ir_value?: number | null
          iss_rate?: number | null
          iss_retention?: boolean | null
          iss_retention_responsible?: number | null
          iss_value: number
          issue_date?: string
          nature_operation?: number | null
          net_value: number
          nfse_link?: string | null
          other_retentions?: number | null
          pis_value?: number | null
          protocol_number?: string | null
          provider_address?: string | null
          provider_city_code?: string | null
          provider_cnpj: string
          provider_im?: string | null
          provider_name: string
          provider_state?: string | null
          quote_id?: string | null
          rps_number: string
          rps_series?: string | null
          rps_type?: number | null
          service_code: string
          service_description: string
          service_value: number
          simple_national?: boolean | null
          special_regime?: number | null
          status?: string
          taker_address?: string | null
          taker_cep?: string | null
          taker_city_code?: string | null
          taker_document: string
          taker_email?: string | null
          taker_name: string
          taker_phone?: string | null
          taker_state?: string | null
          taker_type?: string | null
          transmitted_at?: string | null
          updated_at?: string
          verification_code?: string | null
          xml_nfse?: string | null
          xml_rps?: string | null
        }
        Update: {
          authorized_at?: string | null
          base_calculation?: number
          cancelled_at?: string | null
          cnae_code?: string | null
          cofins_value?: number | null
          competence_date?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          csll_value?: number | null
          cultural_incentive?: boolean | null
          deduction_value?: number | null
          discount_conditioned?: number | null
          discount_unconditioned?: number | null
          error_code?: string | null
          error_message?: string | null
          event_id?: string | null
          id?: string
          inss_value?: number | null
          invoice_number?: string | null
          ir_value?: number | null
          iss_rate?: number | null
          iss_retention?: boolean | null
          iss_retention_responsible?: number | null
          iss_value?: number
          issue_date?: string
          nature_operation?: number | null
          net_value?: number
          nfse_link?: string | null
          other_retentions?: number | null
          pis_value?: number | null
          protocol_number?: string | null
          provider_address?: string | null
          provider_city_code?: string | null
          provider_cnpj?: string
          provider_im?: string | null
          provider_name?: string
          provider_state?: string | null
          quote_id?: string | null
          rps_number?: string
          rps_series?: string | null
          rps_type?: number | null
          service_code?: string
          service_description?: string
          service_value?: number
          simple_national?: boolean | null
          special_regime?: number | null
          status?: string
          taker_address?: string | null
          taker_cep?: string | null
          taker_city_code?: string | null
          taker_document?: string
          taker_email?: string | null
          taker_name?: string
          taker_phone?: string | null
          taker_state?: string | null
          taker_type?: string | null
          transmitted_at?: string | null
          updated_at?: string
          verification_code?: string | null
          xml_nfse?: string | null
          xml_rps?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nfse_invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "event_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_invoices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfse_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "external_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      patrimony_inventory: {
        Row: {
          acquisition_date: string | null
          acquisition_value: number | null
          category: string | null
          condition: string | null
          created_at: string | null
          created_by: string | null
          current_value: number | null
          description: string | null
          id: string
          location: string | null
          name: string
          notes: string | null
          quantity: number | null
          serial_number: string | null
          updated_at: string | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_value?: number | null
          category?: string | null
          condition?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name: string
          notes?: string | null
          quantity?: number | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_value?: number | null
          category?: string | null
          condition?: string | null
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          description?: string | null
          id?: string
          location?: string | null
          name?: string
          notes?: string | null
          quantity?: number | null
          serial_number?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      person_sensitive_data: {
        Row: {
          account_holder_name: string | null
          bank_account: string | null
          bank_account_type: string | null
          bank_agency: string | null
          bank_name: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          id: string
          person_id: string
          person_type: string
          pix_key: string | null
          pix_key_type: string | null
          rg: string | null
          updated_at: string
        }
        Insert: {
          account_holder_name?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          person_id: string
          person_type: string
          pix_key?: string | null
          pix_key_type?: string | null
          rg?: string | null
          updated_at?: string
        }
        Update: {
          account_holder_name?: string | null
          bank_account?: string | null
          bank_account_type?: string | null
          bank_agency?: string | null
          bank_name?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          person_id?: string
          person_type?: string
          pix_key?: string | null
          pix_key_type?: string | null
          rg?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      person_status_history: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          created_at: string
          from_status: string | null
          id: string
          person_id: string
          person_name: string | null
          person_type: string
          reason: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          person_id: string
          person_name?: string | null
          person_type: string
          reason?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          person_id?: string
          person_name?: string | null
          person_type?: string
          reason?: string | null
          to_status?: string
        }
        Relationships: []
      }
      personal_accounts: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          initial_balance_cents: number
          name: string
          owner_id: string
          type: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          initial_balance_cents?: number
          name: string
          owner_id: string
          type?: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          initial_balance_cents?: number
          name?: string
          owner_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_budgets: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          limit_cents: number
          month: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          limit_cents: number
          month: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          limit_cents?: number
          month?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_budgets_category_owner_fk"
            columns: ["category_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      personal_categories: {
        Row: {
          archived: boolean
          color: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["personal_category_kind"]
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          color?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["personal_category_kind"]
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          color?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["personal_category_kind"]
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      personal_expense_attachments: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          owner_id: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          owner_id: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          owner_id?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_expense_attachments_expense_owner_fk"
            columns: ["expense_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_expenses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      personal_expenses: {
        Row: {
          account_id: string | null
          amount_cents: number
          category_id: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          installment_number: number | null
          installment_total: number | null
          kind: Database["public"]["Enums"]["personal_category_kind"]
          notes: string | null
          owner_id: string
          parent_id: string | null
          payment_method: string | null
          recurrence_id: string | null
          reverses_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_cents: number
          category_id?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          kind?: Database["public"]["Enums"]["personal_category_kind"]
          notes?: string | null
          owner_id: string
          parent_id?: string | null
          payment_method?: string | null
          recurrence_id?: string | null
          reverses_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          installment_number?: number | null
          installment_total?: number | null
          kind?: Database["public"]["Enums"]["personal_category_kind"]
          notes?: string | null
          owner_id?: string
          parent_id?: string | null
          payment_method?: string | null
          recurrence_id?: string | null
          reverses_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_expenses_account_owner_fk"
            columns: ["account_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_accounts"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "personal_expenses_category_owner_fk"
            columns: ["category_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "personal_expenses_parent_owner_fk"
            columns: ["parent_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_expenses"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "personal_expenses_recurrence_owner_fk"
            columns: ["recurrence_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_recurrences"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "personal_expenses_reverses_owner_fk"
            columns: ["reverses_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_expenses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      personal_recurrences: {
        Row: {
          account_id: string | null
          active: boolean
          amount_cents: number
          category_id: string | null
          created_at: string
          day_of_period: number | null
          description: string
          end_date: string | null
          frequency: Database["public"]["Enums"]["personal_recurrence_freq"]
          id: string
          owner_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          amount_cents: number
          category_id?: string | null
          created_at?: string
          day_of_period?: number | null
          description: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["personal_recurrence_freq"]
          id?: string
          owner_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          active?: boolean
          amount_cents?: number
          category_id?: string | null
          created_at?: string
          day_of_period?: number | null
          description?: string
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["personal_recurrence_freq"]
          id?: string
          owner_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_recurrences_account_owner_fk"
            columns: ["account_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_accounts"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "personal_recurrences_category_owner_fk"
            columns: ["category_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "personal_categories"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_approvals: {
        Row: {
          accepted_at: string | null
          accepted_ip: string | null
          accepted_name: string | null
          accepted_snapshot: Json | null
          accepted_user_agent: string | null
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          quote_id: string
          rejection_reason: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_name?: string | null
          accepted_snapshot?: Json | null
          accepted_user_agent?: string | null
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          quote_id: string
          rejection_reason?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_ip?: string | null
          accepted_name?: string | null
          accepted_snapshot?: Json | null
          accepted_user_agent?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          quote_id?: string
          rejection_reason?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_approvals_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "external_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expense_monthly_payments: {
        Row: {
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          payment_amount: number
          payment_date: string
          payment_month: number
          payment_year: number
          receipt_path: string | null
          recurring_expense_id: string
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payment_amount?: number
          payment_date: string
          payment_month: number
          payment_year: number
          receipt_path?: string | null
          recurring_expense_id: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payment_amount?: number
          payment_date?: string
          payment_month?: number
          payment_year?: number
          receipt_path?: string | null
          recurring_expense_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_monthly_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_monthly_payments_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expense_payment_plans: {
        Row: {
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          planned_amount: number
          planned_date: string
          recurring_expense_id: string
          status: string
          updated_at: string
        }
        Insert: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          planned_amount: number
          planned_date: string
          recurring_expense_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          planned_amount?: number
          planned_date?: string
          recurring_expense_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expense_payment_plans_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expense_payment_plans_recurring_expense_id_fkey"
            columns: ["recurring_expense_id"]
            isOneToOne: false
            referencedRelation: "recurring_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          due_day: number | null
          end_date: string | null
          id: string
          is_active: boolean
          is_paid: boolean | null
          name: string
          payment_bank_account: string | null
          payment_date: string | null
          receipt_path: string | null
          selected_months: number[] | null
          selected_year: number | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_day?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean | null
          name: string
          payment_bank_account?: string | null
          payment_date?: string | null
          receipt_path?: string | null
          selected_months?: number[] | null
          selected_year?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_day?: number | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          is_paid?: boolean | null
          name?: string
          payment_bank_account?: string | null
          payment_date?: string | null
          receipt_path?: string | null
          selected_months?: number[] | null
          selected_year?: number | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          permission_id: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_bank_accounts: {
        Row: {
          account_agency: string | null
          account_document: string | null
          account_holder: string | null
          account_number: string | null
          bank_name: string | null
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          pix_key: string | null
          updated_at: string
        }
        Insert: {
          account_agency?: string | null
          account_document?: string | null
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          pix_key?: string | null
          updated_at?: string
        }
        Update: {
          account_agency?: string | null
          account_document?: string | null
          account_holder?: string | null
          account_number?: string | null
          bank_name?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          pix_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_signatures: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_default: boolean | null
          name: string
          signature_data: string
          signature_type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          signature_data: string
          signature_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          signature_data?: string
          signature_type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_credentials: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          name: string
          password_hash: string
          password_salt: string | null
          updated_at: string | null
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          name: string
          password_hash: string
          password_salt?: string | null
          updated_at?: string | null
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          name?: string
          password_hash?: string
          password_salt?: string | null
          updated_at?: string | null
          username?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          permission_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          permission_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          permission_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_theme_preferences: {
        Row: {
          color_scheme: string
          created_at: string | null
          custom_colors: Json | null
          density: string
          font_scale: number
          high_contrast: boolean
          id: string
          mode: string
          primary_hsl: string | null
          radius_scale: number
          reduced_motion: boolean
          theme: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color_scheme?: string
          created_at?: string | null
          custom_colors?: Json | null
          density?: string
          font_scale?: number
          high_contrast?: boolean
          id?: string
          mode?: string
          primary_hsl?: string | null
          radius_scale?: number
          reduced_motion?: boolean
          theme?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color_scheme?: string
          created_at?: string | null
          custom_colors?: Json | null
          density?: string
          font_scale?: number
          high_contrast?: boolean
          id?: string
          mode?: string
          primary_hsl?: string | null
          radius_scale?: number
          reduced_motion?: boolean
          theme?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          company_expense_id: string | null
          created_at: string
          event_expense_id: string | null
          event_id: string | null
          extracted_amount: number | null
          extracted_date: string | null
          extracted_description: string | null
          extracted_name: string | null
          extracted_time: string | null
          extraction_confidence: number | null
          extraction_status: string
          id: string
          link_destination: string | null
          linked_record_id: string | null
          linked_record_type: string | null
          matched_event_name: string | null
          message_content: string | null
          message_type: string | null
          person_id: string | null
          person_name: string | null
          person_type: string | null
          processed_at: string | null
          processing_notes: string | null
          received_at: string
          sender_name: string | null
          sender_phone: string
          status: string | null
          updated_at: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          company_expense_id?: string | null
          created_at?: string
          event_expense_id?: string | null
          event_id?: string | null
          extracted_amount?: number | null
          extracted_date?: string | null
          extracted_description?: string | null
          extracted_name?: string | null
          extracted_time?: string | null
          extraction_confidence?: number | null
          extraction_status?: string
          id?: string
          link_destination?: string | null
          linked_record_id?: string | null
          linked_record_type?: string | null
          matched_event_name?: string | null
          message_content?: string | null
          message_type?: string | null
          person_id?: string | null
          person_name?: string | null
          person_type?: string | null
          processed_at?: string | null
          processing_notes?: string | null
          received_at?: string
          sender_name?: string | null
          sender_phone: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          company_expense_id?: string | null
          created_at?: string
          event_expense_id?: string | null
          event_id?: string | null
          extracted_amount?: number | null
          extracted_date?: string | null
          extracted_description?: string | null
          extracted_name?: string | null
          extracted_time?: string | null
          extraction_confidence?: number | null
          extraction_status?: string
          id?: string
          link_destination?: string | null
          linked_record_id?: string | null
          linked_record_type?: string | null
          matched_event_name?: string | null
          message_content?: string | null
          message_type?: string | null
          person_id?: string | null
          person_name?: string | null
          person_type?: string | null
          processed_at?: string | null
          processing_notes?: string | null
          received_at?: string
          sender_name?: string | null
          sender_phone?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_expense_id_fkey"
            columns: ["company_expense_id"]
            isOneToOne: false
            referencedRelation: "company_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_event_expense_id_fkey"
            columns: ["event_expense_id"]
            isOneToOne: false
            referencedRelation: "event_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_advances: {
        Row: {
          advance_date: string
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_finalized: boolean | null
          notes: string | null
          updated_at: string
          worker_name: string
        }
        Insert: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_finalized?: boolean | null
          notes?: string | null
          updated_at?: string
          worker_name: string
        }
        Update: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_finalized?: boolean | null
          notes?: string | null
          updated_at?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_availability: {
        Row: {
          availability: string
          availability_date: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period: string
          updated_at: string
          worker_id: string | null
          worker_name: string | null
        }
        Insert: {
          availability?: string
          availability_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period?: string
          updated_at?: string
          worker_id?: string | null
          worker_name?: string | null
        }
        Update: {
          availability?: string
          availability_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period?: string
          updated_at?: string
          worker_id?: string | null
          worker_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_availability_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_expense_advances: {
        Row: {
          advance_date: string
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_finalized: boolean
          notes: string | null
          receipt_url: string | null
          updated_at: string
          worker_name: string
        }
        Insert: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_finalized?: boolean
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string
          worker_name: string
        }
        Update: {
          advance_date?: string
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_finalized?: boolean
          notes?: string | null
          receipt_url?: string | null
          updated_at?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_expense_advances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_food_allowances: {
        Row: {
          allowance_date: string
          allowance_type: string | null
          amount: number
          bank_account_id: string | null
          created_at: string
          created_by: string | null
          event_id: string | null
          id: string
          notes: string | null
          updated_at: string
          worker_name: string
        }
        Insert: {
          allowance_date?: string
          allowance_type?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          worker_name: string
        }
        Update: {
          allowance_date?: string
          allowance_type?: string | null
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          created_by?: string | null
          event_id?: string | null
          id?: string
          notes?: string | null
          updated_at?: string
          worker_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_food_allowances_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_food_allowances_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      workers: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_district: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          birth_date: string | null
          created_at: string
          created_by: string | null
          default_daily_rate: number | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string
          id: string
          image_url: string | null
          internal_notes: string | null
          name: string
          notes: string | null
          phone: string | null
          pix_key: string | null
          primary_role: string | null
          secondary_roles: string[]
          shoe_size: string | null
          skills: string[]
          social_name: string | null
          status: string
          status_reason: string | null
          uniform_size: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          default_daily_rate?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string
          id?: string
          image_url?: string | null
          internal_notes?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          primary_role?: string | null
          secondary_roles?: string[]
          shoe_size?: string | null
          skills?: string[]
          social_name?: string | null
          status?: string
          status_reason?: string | null
          uniform_size?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_district?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          birth_date?: string | null
          created_at?: string
          created_by?: string | null
          default_daily_rate?: number | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string
          id?: string
          image_url?: string | null
          internal_notes?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          pix_key?: string | null
          primary_role?: string | null
          secondary_roles?: string[]
          shoe_size?: string | null
          skills?: string[]
          social_name?: string | null
          status?: string
          status_reason?: string | null
          uniform_size?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_balance_from_transactions: {
        Args: { account_id_param: string }
        Returns: number
      }
      current_user_has_any_role: {
        Args: { _roles: string[] }
        Returns: boolean
      }
      has_permission: {
        Args: {
          _access_type?: string
          _permission_name: string
          _user_id: string
        }
        Returns: boolean
      }
      is_bank_period_closed: {
        Args: { _account_id: string; _date: string }
        Returns: boolean
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      next_quote_number: { Args: never; Returns: string }
      storage_path_is_safe: {
        Args: { _exts: string[]; _name: string }
        Returns: boolean
      }
      sync_bank_transactions: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "funcionario" | "financeiro" | "deposito"
      personal_category_kind: "expense" | "income"
      personal_recurrence_freq: "weekly" | "monthly" | "yearly"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "funcionario", "financeiro", "deposito"],
      personal_category_kind: ["expense", "income"],
      personal_recurrence_freq: ["weekly", "monthly", "yearly"],
    },
  },
} as const
