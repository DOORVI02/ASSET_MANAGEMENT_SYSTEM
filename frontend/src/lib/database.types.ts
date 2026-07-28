/**
 * Real `supabase gen types typescript --linked` output — regenerated 2026-07-28.
 *
 * The hand-written placeholder this replaced (see git history) was written back in
 * Phase 9/11 because `gen types` appeared to require a container runtime (Docker/
 * Podman) even against a remote project. That turned out to be wrong for this CLI
 * version (2.110.0): the command works fine here with no container runtime at all —
 * caught by a documentation walkthrough that happened to actually run the command
 * the docs described, rather than trusting the earlier note. Diffed field-for-field
 * against the hand-written version first; no discrepancies found.
 *
 * Regenerate with: `supabase gen types typescript --linked > src/lib/database.types.ts`
 * (run from `supabase/`, with `SUPABASE_ACCESS_TOKEN` set) after any migration.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          cloudinary_public_id: string | null;
          entity_id: string;
          entity_type: Database['public']['Enums']['attachment_entity_type'];
          file_name: string;
          file_size: number;
          file_type: string;
          id: string;
          status: Database['public']['Enums']['attachment_status'];
          uploaded_at: string;
          uploaded_by: string;
          url: string;
        };
        Insert: {
          cloudinary_public_id?: string | null;
          entity_id: string;
          entity_type: Database['public']['Enums']['attachment_entity_type'];
          file_name: string;
          file_size: number;
          file_type: string;
          id?: string;
          status?: Database['public']['Enums']['attachment_status'];
          uploaded_at?: string;
          uploaded_by: string;
          url: string;
        };
        Update: {
          cloudinary_public_id?: string | null;
          entity_id?: string;
          entity_type?: Database['public']['Enums']['attachment_entity_type'];
          file_name?: string;
          file_size?: number;
          file_type?: string;
          id?: string;
          status?: Database['public']['Enums']['attachment_status'];
          uploaded_at?: string;
          uploaded_by?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attachments_uploaded_by_fkey';
            columns: ['uploaded_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          changes: string;
          entity_id: string;
          entity_type: string;
          id: string;
          performed_at: string;
          performed_by: string;
        };
        Insert: {
          action: string;
          changes: string;
          entity_id: string;
          entity_type: string;
          id?: string;
          performed_at?: string;
          performed_by: string;
        };
        Update: {
          action?: string;
          changes?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
          performed_at?: string;
          performed_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_performed_by_fkey';
            columns: ['performed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      departments: {
        Row: {
          code: string;
          created_at: string;
          head: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          head?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          head?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      machine_parts: {
        Row: {
          category: string;
          created_at: string;
          expected_life_months: number | null;
          fitted_date: string;
          id: string;
          is_archived: boolean;
          machine_id: string;
          notes: string;
          part_code: string;
          part_name: string;
          position_on_machine: string;
          quantity: number;
          serial_number: string | null;
          unit: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          expected_life_months?: number | null;
          fitted_date: string;
          id?: string;
          is_archived?: boolean;
          machine_id: string;
          notes?: string;
          part_code: string;
          part_name: string;
          position_on_machine: string;
          quantity: number;
          serial_number?: string | null;
          unit: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          expected_life_months?: number | null;
          fitted_date?: string;
          id?: string;
          is_archived?: boolean;
          machine_id?: string;
          notes?: string;
          part_code?: string;
          part_name?: string;
          position_on_machine?: string;
          quantity?: number;
          serial_number?: string | null;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'machine_parts_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'machine_parts_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines_with_derived';
            referencedColumns: ['id'];
          },
        ];
      };
      machines: {
        Row: {
          bay_section: string | null;
          capacity: string | null;
          code: string;
          created_at: string;
          department_id: string;
          description: string;
          floor: string | null;
          id: string;
          installation_date: string;
          is_archived: boolean;
          location: string;
          manufacturer: string;
          model: string;
          name: string;
          next_maintenance_date: string;
          plant_area: string | null;
          power_rating: string | null;
          room_position: string | null;
          serial_number: string | null;
          status: Database['public']['Enums']['machine_status'];
          type: Database['public']['Enums']['machine_type'];
          updated_at: string;
          voltage: string | null;
          weight: string | null;
        };
        Insert: {
          bay_section?: string | null;
          capacity?: string | null;
          code: string;
          created_at?: string;
          department_id: string;
          description?: string;
          floor?: string | null;
          id?: string;
          installation_date: string;
          is_archived?: boolean;
          location: string;
          manufacturer: string;
          model: string;
          name: string;
          next_maintenance_date: string;
          plant_area?: string | null;
          power_rating?: string | null;
          room_position?: string | null;
          serial_number?: string | null;
          status?: Database['public']['Enums']['machine_status'];
          type: Database['public']['Enums']['machine_type'];
          updated_at?: string;
          voltage?: string | null;
          weight?: string | null;
        };
        Update: {
          bay_section?: string | null;
          capacity?: string | null;
          code?: string;
          created_at?: string;
          department_id?: string;
          description?: string;
          floor?: string | null;
          id?: string;
          installation_date?: string;
          is_archived?: boolean;
          location?: string;
          manufacturer?: string;
          model?: string;
          name?: string;
          next_maintenance_date?: string;
          plant_area?: string | null;
          power_rating?: string | null;
          room_position?: string | null;
          serial_number?: string | null;
          status?: Database['public']['Enums']['machine_status'];
          type?: Database['public']['Enums']['machine_type'];
          updated_at?: string;
          voltage?: string | null;
          weight?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };
      maintenance_plans: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          interval_unit: Database['public']['Enums']['recurrence_unit'];
          interval_value: number;
          is_active: boolean;
          is_archived: boolean;
          last_completed_date: string | null;
          machine_id: string;
          technician_id: string | null;
          type: Database['public']['Enums']['maintenance_type'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          interval_unit: Database['public']['Enums']['recurrence_unit'];
          interval_value: number;
          is_active?: boolean;
          is_archived?: boolean;
          last_completed_date?: string | null;
          machine_id: string;
          technician_id?: string | null;
          type: Database['public']['Enums']['maintenance_type'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          interval_unit?: Database['public']['Enums']['recurrence_unit'];
          interval_value?: number;
          is_active?: boolean;
          is_archived?: boolean;
          last_completed_date?: string | null;
          machine_id?: string;
          technician_id?: string | null;
          type?: Database['public']['Enums']['maintenance_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'maintenance_plans_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_plans_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines_with_derived';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_plans_technician_id_fkey';
            columns: ['technician_id'];
            isOneToOne: false;
            referencedRelation: 'technicians';
            referencedColumns: ['id'];
          },
        ];
      };
      maintenance_records: {
        Row: {
          actions: string | null;
          completed_date: string | null;
          created_at: string;
          description: string;
          duration_hours: number | null;
          findings: string | null;
          id: string;
          machine_id: string;
          parts_used: string | null;
          plan_id: string | null;
          remarks: string | null;
          scheduled_date: string;
          status: Database['public']['Enums']['maintenance_status'];
          technician_id: string;
          type: Database['public']['Enums']['maintenance_type'];
          updated_at: string;
        };
        Insert: {
          actions?: string | null;
          completed_date?: string | null;
          created_at?: string;
          description: string;
          duration_hours?: number | null;
          findings?: string | null;
          id?: string;
          machine_id: string;
          parts_used?: string | null;
          plan_id?: string | null;
          remarks?: string | null;
          scheduled_date: string;
          status?: Database['public']['Enums']['maintenance_status'];
          technician_id: string;
          type: Database['public']['Enums']['maintenance_type'];
          updated_at?: string;
        };
        Update: {
          actions?: string | null;
          completed_date?: string | null;
          created_at?: string;
          description?: string;
          duration_hours?: number | null;
          findings?: string | null;
          id?: string;
          machine_id?: string;
          parts_used?: string | null;
          plan_id?: string | null;
          remarks?: string | null;
          scheduled_date?: string;
          status?: Database['public']['Enums']['maintenance_status'];
          technician_id?: string;
          type?: Database['public']['Enums']['maintenance_type'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'maintenance_records_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_records_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines_with_derived';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_records_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'maintenance_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_records_technician_id_fkey';
            columns: ['technician_id'];
            isOneToOne: false;
            referencedRelation: 'technicians';
            referencedColumns: ['id'];
          },
        ];
      };
      part_replacements: {
        Row: {
          created_at: string;
          id: string;
          new_serial_number: string | null;
          notes: string | null;
          part_id: string;
          performed_by: string;
          previous_serial_number: string | null;
          reason: string;
          replaced_on: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          new_serial_number?: string | null;
          notes?: string | null;
          part_id: string;
          performed_by: string;
          previous_serial_number?: string | null;
          reason: string;
          replaced_on: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          new_serial_number?: string | null;
          notes?: string | null;
          part_id?: string;
          performed_by?: string;
          previous_serial_number?: string | null;
          reason?: string;
          replaced_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'part_replacements_part_id_fkey';
            columns: ['part_id'];
            isOneToOne: false;
            referencedRelation: 'machine_parts';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'part_replacements_performed_by_fkey';
            columns: ['performed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profile_department_scope: {
        Row: {
          created_at: string;
          department_id: string;
          profile_id: string;
        };
        Insert: {
          created_at?: string;
          department_id: string;
          profile_id: string;
        };
        Update: {
          created_at?: string;
          department_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profile_department_scope_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'profile_department_scope_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'profile_department_scope_profile_id_fkey';
            columns: ['profile_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          department_id: string;
          email: string;
          id: string;
          is_active: boolean;
          name: string;
          phone: string;
          position: string;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          department_id: string;
          email: string;
          id: string;
          is_active?: boolean;
          name: string;
          phone: string;
          position: string;
          role: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          department_id?: string;
          email?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          phone?: string;
          position?: string;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'profiles_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };
      repair_records: {
        Row: {
          assigned_to: string | null;
          completed_date: string | null;
          created_at: string;
          description: string;
          diagnosis: string | null;
          downtime_hours: number | null;
          id: string;
          machine_id: string;
          parts_used: string | null;
          remarks: string | null;
          reported_by: string;
          reported_date: string;
          resolution: string | null;
          start_date: string | null;
          status: Database['public']['Enums']['repair_status'];
          updated_at: string;
        };
        Insert: {
          assigned_to?: string | null;
          completed_date?: string | null;
          created_at?: string;
          description: string;
          diagnosis?: string | null;
          downtime_hours?: number | null;
          id?: string;
          machine_id: string;
          parts_used?: string | null;
          remarks?: string | null;
          reported_by: string;
          reported_date: string;
          resolution?: string | null;
          start_date?: string | null;
          status?: Database['public']['Enums']['repair_status'];
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          completed_date?: string | null;
          created_at?: string;
          description?: string;
          diagnosis?: string | null;
          downtime_hours?: number | null;
          id?: string;
          machine_id?: string;
          parts_used?: string | null;
          remarks?: string | null;
          reported_by?: string;
          reported_date?: string;
          resolution?: string | null;
          start_date?: string | null;
          status?: Database['public']['Enums']['repair_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'repair_records_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'repair_records_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines_with_derived';
            referencedColumns: ['id'];
          },
        ];
      };
      technicians: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      department_summary: {
        Row: {
          active: number | null;
          department_id: string | null;
          due_soon: number | null;
          inactive: number | null;
          overdue: number | null;
          retired: number | null;
          total: number | null;
          under_maintenance: number | null;
          under_repair: number | null;
        };
        Relationships: [];
      };
      machines_with_derived: {
        Row: {
          bay_section: string | null;
          capacity: string | null;
          code: string | null;
          created_at: string | null;
          department_code: string | null;
          department_id: string | null;
          department_name: string | null;
          description: string | null;
          due_state: string | null;
          floor: string | null;
          id: string | null;
          image_url: string | null;
          installation_date: string | null;
          is_archived: boolean | null;
          last_maintenance_date: string | null;
          location: string | null;
          manufacturer: string | null;
          model: string | null;
          name: string | null;
          next_maintenance_date: string | null;
          plant_area: string | null;
          power_rating: string | null;
          room_position: string | null;
          serial_number: string | null;
          status: Database['public']['Enums']['machine_status'] | null;
          type: Database['public']['Enums']['machine_type'] | null;
          updated_at: string | null;
          voltage: string | null;
          weight: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };
      maintenance_summary: {
        Row: {
          cancelled: number | null;
          completed: number | null;
          department_id: string | null;
          due_soon: number | null;
          in_progress: number | null;
          overdue: number | null;
          scheduled: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };
      parts_summary: {
        Row: {
          categories: number | null;
          department_id: string | null;
          due_soon: number | null;
          machines_with_parts: number | null;
          overdue: number | null;
          total: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };
      repair_summary: {
        Row: {
          cancelled: number | null;
          completed: number | null;
          department_id: string | null;
          downtime_hours: number | null;
          in_progress: number | null;
          reported: number | null;
          waiting_for_parts: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'department_summary';
            referencedColumns: ['department_id'];
          },
          {
            foreignKeyName: 'machines_department_id_fkey';
            columns: ['department_id'];
            isOneToOne: false;
            referencedRelation: 'departments';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      auth_can_see_archived: { Args: never; Returns: boolean };
      auth_department_ids: { Args: never; Returns: string[] };
      auth_role: {
        Args: never;
        Returns: Database['public']['Enums']['app_role'];
      };
      due_state: {
        Args: { p_date: string; p_is_open: boolean };
        Returns: string;
      };
      entity_department_id: {
        Args: { p_entity_id: string; p_entity_type: string };
        Returns: string;
      };
      part_life_state: {
        Args: { p_expected_life_months: number; p_fitted_date: string };
        Returns: string;
      };
      part_replacement_due_date: {
        Args: { p_expected_life_months: number; p_fitted_date: string };
        Returns: string;
      };
      recompute_machine_status: {
        Args: { p_machine_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'officer' | 'supervisor';
      attachment_entity_type: 'machine' | 'part' | 'maintenance' | 'repair';
      attachment_status: 'pending' | 'ready' | 'deleting' | 'failed';
      machine_status: 'active' | 'inactive' | 'under_maintenance' | 'under_repair' | 'retired';
      machine_type:
        | 'motor'
        | 'pump'
        | 'compressor'
        | 'crane'
        | 'conveyor'
        | 'press'
        | 'mill'
        | 'blower'
        | 'lathe'
        | 'other';
      maintenance_status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
      maintenance_type:
        'preventive' | 'corrective' | 'inspection' | 'lubrication' | 'calibration' | 'emergency';
      recurrence_unit: 'days' | 'weeks' | 'months' | 'years';
      repair_status: 'reported' | 'in_progress' | 'waiting_for_parts' | 'completed' | 'cancelled';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ['officer', 'supervisor'],
      attachment_entity_type: ['machine', 'part', 'maintenance', 'repair'],
      attachment_status: ['pending', 'ready', 'deleting', 'failed'],
      machine_status: ['active', 'inactive', 'under_maintenance', 'under_repair', 'retired'],
      machine_type: [
        'motor',
        'pump',
        'compressor',
        'crane',
        'conveyor',
        'press',
        'mill',
        'blower',
        'lathe',
        'other',
      ],
      maintenance_status: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      maintenance_type: [
        'preventive',
        'corrective',
        'inspection',
        'lubrication',
        'calibration',
        'emergency',
      ],
      recurrence_unit: ['days', 'weeks', 'months', 'years'],
      repair_status: ['reported', 'in_progress', 'waiting_for_parts', 'completed', 'cancelled'],
    },
  },
} as const;
