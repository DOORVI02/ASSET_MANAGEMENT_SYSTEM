/**
 * Hand-written Supabase database types, matching the schema actually applied by
 * `supabase/migrations/*.sql` (verified live against `information_schema` on
 * 2026-07-27, not just read off the migration source).
 *
 * These are **not** `supabase gen types` output: that command requires a container
 * runtime (Docker/Podman) even against a remote `--db-url`, which this environment does
 * not have (`.agents/phases.md` Phase 9 records the exact failure). This file must be
 * **replaced exactly** by the real generated output the moment `gen types` becomes
 * runnable — keep the `Database` export name so `src/lib/supabase.ts` does not need to
 * change. Until then, treat any drift between this file and a real migration as a bug
 * in this file, not in the schema.
 */

export type AppRole = 'officer' | 'supervisor';
export type DbMachineStatus =
  'active' | 'inactive' | 'under_maintenance' | 'under_repair' | 'retired';
export type DbMachineType =
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
export type DbMaintenanceType =
  'preventive' | 'corrective' | 'inspection' | 'lubrication' | 'calibration' | 'emergency';
export type DbMaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type DbRecurrenceUnit = 'days' | 'weeks' | 'months' | 'years';
export type DbRepairStatus =
  'reported' | 'in_progress' | 'waiting_for_parts' | 'completed' | 'cancelled';
export type DbAttachmentEntityType = 'machine' | 'part' | 'maintenance' | 'repair';
export type DbAttachmentStatus = 'pending' | 'ready' | 'deleting' | 'failed';
/** Not a Postgres enum — `due_state()` returns plain `text`, matching the frontend's `DueState`. */
export type DbDueState = 'ok' | 'due_soon' | 'overdue' | 'not_applicable';

/**
 * A type alias, not an `interface` — intersecting an interface into a Row (`{...} &
 * Timestamps`) silently breaks TypeScript's `extends Record<string, unknown>`
 * structural check that `@supabase/postgrest-js` relies on internally, which cascades
 * into every table resolving to `never` for the whole client. Confirmed by isolating
 * the exact same field set as a plain type alias (works) vs an interface (fails) —
 * this is apparently a genuine TS quirk, not a mistake in the field list itself.
 */
type Timestamps = {
  created_at: string;
  updated_at: string;
};

export interface Database {
  public: {
    Tables: {
      departments: {
        Row: {
          id: string;
          code: string;
          name: string;
          head: string;
          is_active: boolean;
          sort_order: number;
        } & Timestamps;
        Insert: Partial<
          Pick<
            Database['public']['Tables']['departments']['Row'],
            'id' | 'head' | 'is_active' | 'sort_order'
          >
        > &
          Pick<Database['public']['Tables']['departments']['Row'], 'code' | 'name'>;
        Update: Partial<Database['public']['Tables']['departments']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string;
          role: AppRole;
          position: string;
          department_id: string;
          is_active: boolean;
        } & Timestamps;
        Insert: Omit<
          Database['public']['Tables']['profiles']['Row'],
          'created_at' | 'updated_at' | 'is_active'
        > &
          Partial<Pick<Database['public']['Tables']['profiles']['Row'], 'is_active'>>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      profile_department_scope: {
        Row: { profile_id: string; department_id: string; created_at: string };
        Insert: { profile_id: string; department_id: string };
        Update: Partial<Database['public']['Tables']['profile_department_scope']['Insert']>;
        Relationships: [];
      };
      technicians: {
        Row: { id: string; name: string; is_active: boolean; created_at: string };
        Insert: Partial<
          Pick<Database['public']['Tables']['technicians']['Row'], 'id' | 'is_active'>
        > &
          Pick<Database['public']['Tables']['technicians']['Row'], 'name'>;
        Update: Partial<Database['public']['Tables']['technicians']['Insert']>;
        Relationships: [];
      };
      machines: {
        Row: {
          id: string;
          code: string;
          name: string;
          department_id: string;
          type: DbMachineType;
          manufacturer: string;
          model: string;
          location: string;
          status: DbMachineStatus;
          installation_date: string;
          next_maintenance_date: string;
          description: string;
          serial_number: string | null;
          capacity: string | null;
          power_rating: string | null;
          voltage: string | null;
          weight: string | null;
          plant_area: string | null;
          bay_section: string | null;
          floor: string | null;
          room_position: string | null;
          is_archived: boolean;
        } & Timestamps;
        Insert: Partial<
          Pick<
            Database['public']['Tables']['machines']['Row'],
            | 'id'
            | 'status'
            | 'description'
            | 'serial_number'
            | 'capacity'
            | 'power_rating'
            | 'voltage'
            | 'weight'
            | 'plant_area'
            | 'bay_section'
            | 'floor'
            | 'room_position'
            | 'is_archived'
          >
        > &
          Pick<
            Database['public']['Tables']['machines']['Row'],
            | 'code'
            | 'name'
            | 'department_id'
            | 'type'
            | 'manufacturer'
            | 'model'
            | 'location'
            | 'installation_date'
            | 'next_maintenance_date'
          >;
        Update: Partial<Database['public']['Tables']['machines']['Insert']>;
        Relationships: [];
      };
      machine_parts: {
        Row: {
          id: string;
          machine_id: string;
          part_code: string;
          part_name: string;
          category: string;
          serial_number: string | null;
          quantity: number;
          unit: string;
          position_on_machine: string;
          fitted_date: string;
          expected_life_months: number | null;
          notes: string;
          is_archived: boolean;
        } & Timestamps;
        Insert: Partial<
          Pick<
            Database['public']['Tables']['machine_parts']['Row'],
            'id' | 'serial_number' | 'expected_life_months' | 'notes' | 'is_archived'
          >
        > &
          Pick<
            Database['public']['Tables']['machine_parts']['Row'],
            | 'machine_id'
            | 'part_code'
            | 'part_name'
            | 'category'
            | 'quantity'
            | 'unit'
            | 'position_on_machine'
            | 'fitted_date'
          >;
        Update: Partial<Database['public']['Tables']['machine_parts']['Insert']>;
        Relationships: [];
      };
      part_replacements: {
        Row: {
          id: string;
          part_id: string;
          replaced_on: string;
          reason: string;
          previous_serial_number: string | null;
          new_serial_number: string | null;
          performed_by: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<
          Pick<
            Database['public']['Tables']['part_replacements']['Row'],
            'id' | 'previous_serial_number' | 'new_serial_number' | 'notes'
          >
        > &
          Pick<
            Database['public']['Tables']['part_replacements']['Row'],
            'part_id' | 'replaced_on' | 'reason' | 'performed_by'
          >;
        Update: never; // append-only: no UPDATE grant exists for anyone.
        Relationships: [];
      };
      maintenance_plans: {
        Row: {
          id: string;
          machine_id: string;
          type: DbMaintenanceType;
          description: string;
          interval_value: number;
          interval_unit: DbRecurrenceUnit;
          technician_id: string | null;
          is_active: boolean;
          is_archived: boolean;
          last_completed_date: string | null;
        } & Timestamps;
        Insert: Partial<
          Pick<
            Database['public']['Tables']['maintenance_plans']['Row'],
            'id' | 'technician_id' | 'is_active' | 'is_archived' | 'last_completed_date'
          >
        > &
          Pick<
            Database['public']['Tables']['maintenance_plans']['Row'],
            'machine_id' | 'type' | 'description' | 'interval_value' | 'interval_unit'
          >;
        Update: Partial<Database['public']['Tables']['maintenance_plans']['Insert']>;
        Relationships: [];
      };
      maintenance_records: {
        Row: {
          id: string;
          machine_id: string;
          plan_id: string | null;
          type: DbMaintenanceType;
          status: DbMaintenanceStatus;
          scheduled_date: string;
          completed_date: string | null;
          technician_id: string;
          description: string;
          findings: string | null;
          actions: string | null;
          parts_used: string | null;
          duration_hours: number | null;
          remarks: string | null;
        } & Timestamps;
        Insert: Partial<
          Pick<
            Database['public']['Tables']['maintenance_records']['Row'],
            | 'id'
            | 'plan_id'
            | 'status'
            | 'completed_date'
            | 'findings'
            | 'actions'
            | 'parts_used'
            | 'duration_hours'
            | 'remarks'
          >
        > &
          Pick<
            Database['public']['Tables']['maintenance_records']['Row'],
            'machine_id' | 'type' | 'scheduled_date' | 'technician_id' | 'description'
          >;
        Update: Partial<Database['public']['Tables']['maintenance_records']['Insert']>;
        Relationships: [];
      };
      repair_records: {
        Row: {
          id: string;
          machine_id: string;
          status: DbRepairStatus;
          reported_date: string;
          start_date: string | null;
          completed_date: string | null;
          reported_by: string;
          assigned_to: string | null;
          description: string;
          diagnosis: string | null;
          resolution: string | null;
          parts_used: string | null;
          downtime_hours: number | null;
          remarks: string | null;
        } & Timestamps;
        Insert: Partial<
          Pick<
            Database['public']['Tables']['repair_records']['Row'],
            | 'id'
            | 'status'
            | 'start_date'
            | 'completed_date'
            | 'assigned_to'
            | 'diagnosis'
            | 'resolution'
            | 'parts_used'
            | 'downtime_hours'
            | 'remarks'
          >
        > &
          Pick<
            Database['public']['Tables']['repair_records']['Row'],
            'machine_id' | 'reported_date' | 'reported_by' | 'description'
          >;
        Update: Partial<Database['public']['Tables']['repair_records']['Insert']>;
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          entity_id: string;
          entity_type: DbAttachmentEntityType;
          file_name: string;
          file_type: string;
          file_size: number;
          uploaded_by: string;
          uploaded_at: string;
          url: string;
          cloudinary_public_id: string | null;
          status: DbAttachmentStatus;
        };
        Insert: Partial<
          Pick<
            Database['public']['Tables']['attachments']['Row'],
            'id' | 'uploaded_at' | 'cloudinary_public_id' | 'status'
          >
        > &
          Pick<
            Database['public']['Tables']['attachments']['Row'],
            | 'entity_id'
            | 'entity_type'
            | 'file_name'
            | 'file_type'
            | 'file_size'
            | 'uploaded_by'
            | 'url'
          >;
        Update: never; // no UPDATE grant for `authenticated` — Phase 12's Edge Functions use the service role.
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          entity_id: string;
          entity_type: string;
          action: string;
          performed_by: string;
          performed_at: string;
          changes: string;
        };
        Insert: never; // written only by triggers — no INSERT grant for `authenticated`.
        Update: never; // append-only by trigger, even against the table owner.
        Relationships: [];
      };
      app_settings: {
        Row: { key: string; value: unknown; updated_at: string };
        Insert: never; // no grant of any kind yet — nothing reads or writes this table.
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      machines_with_derived: {
        Row: Database['public']['Tables']['machines']['Row'] & {
          department_name: string;
          department_code: string;
          last_maintenance_date: string | null;
          due_state: DbDueState;
          image_url: string | null;
        };
        Relationships: [];
      };
      department_summary: {
        Row: {
          department_id: string;
          total: number;
          active: number;
          inactive: number;
          under_maintenance: number;
          under_repair: number;
          retired: number;
          due_soon: number;
          overdue: number;
        };
        Relationships: [];
      };
      maintenance_summary: {
        Row: {
          department_id: string;
          scheduled: number;
          in_progress: number;
          completed: number;
          cancelled: number;
          due_soon: number;
          overdue: number;
        };
        Relationships: [];
      };
      repair_summary: {
        Row: {
          department_id: string;
          reported: number;
          in_progress: number;
          waiting_for_parts: number;
          completed: number;
          cancelled: number;
          downtime_hours: number;
        };
        Relationships: [];
      };
      parts_summary: {
        Row: {
          department_id: string;
          total: number;
          machines_with_parts: number;
          categories: number;
          due_soon: number;
          overdue: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      machine_status: DbMachineStatus;
      machine_type: DbMachineType;
      maintenance_type: DbMaintenanceType;
      maintenance_status: DbMaintenanceStatus;
      recurrence_unit: DbRecurrenceUnit;
      repair_status: DbRepairStatus;
      attachment_entity_type: DbAttachmentEntityType;
      attachment_status: DbAttachmentStatus;
    };
  };
}
