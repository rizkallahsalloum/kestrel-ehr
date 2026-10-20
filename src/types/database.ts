// Hand-written to match supabase/migrations until `pnpm db:types` can run
// against the hosted test project; regenerate it there and diff the result.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Database["public"]["Enums"]["app_role"];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: Database["public"]["Enums"]["app_role"];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      care_teams: {
        Row: { id: string; name: string; created_at: string; updated_at: string };
        Insert: { id?: string; name: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["care_teams"]["Insert"]>;
        Relationships: [];
      };
      care_team_members: {
        Row: { care_team_id: string; profile_id: string; added_by: string | null; created_at: string };
        Insert: { care_team_id: string; profile_id: string; added_by?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["care_team_members"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "care_team_members_care_team_id_fkey";
            columns: ["care_team_id"];
            isOneToOne: false;
            referencedRelation: "care_teams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "care_team_members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "care_team_members_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          id: string;
          mrn: string;
          given_name: string;
          family_name: string;
          date_of_birth: string;
          sex: string;
          care_team_id: string;
          is_synthetic: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mrn: string;
          given_name: string;
          family_name: string;
          date_of_birth: string;
          sex: string;
          care_team_id: string;
          is_synthetic?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patients"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "patients_care_team_id_fkey";
            columns: ["care_team_id"];
            isOneToOne: false;
            referencedRelation: "care_teams";
            referencedColumns: ["id"];
          },
        ];
      };
      drug_classes: {
        Row: { code: string; name: string; created_at: string; updated_at: string };
        Insert: { code: string; name: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["drug_classes"]["Insert"]>;
        Relationships: [];
      };
      medications: {
        Row: {
          id: string;
          name: string;
          strength: string;
          form: string;
          drug_class_code: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          strength: string;
          form: string;
          drug_class_code: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["medications"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "medications_drug_class_code_fkey";
            columns: ["drug_class_code"];
            isOneToOne: false;
            referencedRelation: "drug_classes";
            referencedColumns: ["code"];
          },
        ];
      };
      interaction_rules: {
        Row: {
          id: string;
          rule_code: string;
          rule_type: Database["public"]["Enums"]["rule_type"];
          class_a: string;
          class_b: string | null;
          severity: Database["public"]["Enums"]["alert_severity"];
          message: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          rule_code: string;
          rule_type: Database["public"]["Enums"]["rule_type"];
          class_a: string;
          class_b?: string | null;
          severity: Database["public"]["Enums"]["alert_severity"];
          message: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["interaction_rules"]["Insert"]>;
        Relationships: [];
      };
      allergies: {
        Row: {
          id: string;
          patient_id: string;
          drug_class_code: string | null;
          substance_text: string;
          reaction: string | null;
          severity: Database["public"]["Enums"]["allergy_severity"];
          status: Database["public"]["Enums"]["record_status"];
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          drug_class_code?: string | null;
          substance_text: string;
          reaction?: string | null;
          severity: Database["public"]["Enums"]["allergy_severity"];
          status?: Database["public"]["Enums"]["record_status"];
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["allergies"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "allergies_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allergies_drug_class_code_fkey";
            columns: ["drug_class_code"];
            isOneToOne: false;
            referencedRelation: "drug_classes";
            referencedColumns: ["code"];
          },
        ];
      };
      patient_medications: {
        Row: {
          id: string;
          patient_id: string;
          medication_id: string;
          status: Database["public"]["Enums"]["record_status"];
          dose_text: string | null;
          start_date: string;
          end_date: string | null;
          source_prescription_id: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          medication_id: string;
          status?: Database["public"]["Enums"]["record_status"];
          dose_text?: string | null;
          start_date: string;
          end_date?: string | null;
          source_prescription_id?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patient_medications"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "patient_medications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_medications_medication_id_fkey";
            columns: ["medication_id"];
            isOneToOne: false;
            referencedRelation: "medications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "patient_medications_source_prescription_fkey";
            columns: ["source_prescription_id"];
            isOneToOne: true;
            referencedRelation: "prescriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      prescriptions: {
        Row: {
          id: string;
          patient_id: string;
          medication_id: string;
          prescriber_id: string;
          dose_amount: number;
          dose_unit: Database["public"]["Enums"]["dose_unit"];
          route: Database["public"]["Enums"]["medication_route"];
          frequency: Database["public"]["Enums"]["dose_frequency"];
          quantity: number;
          refills: number;
          duration_days: number | null;
          start_date: string;
          instructions: string | null;
          status: Database["public"]["Enums"]["prescription_status"];
          version: number;
          idempotency_key: string;
          last_evaluated_version: number | null;
          signed_by: string | null;
          signed_at: string | null;
          cancelled_by: string | null;
          cancelled_at: string | null;
          cancel_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          patient_id: string;
          medication_id: string;
          prescriber_id: string;
          dose_amount: number;
          dose_unit: Database["public"]["Enums"]["dose_unit"];
          route: Database["public"]["Enums"]["medication_route"];
          frequency: Database["public"]["Enums"]["dose_frequency"];
          quantity: number;
          refills?: number;
          duration_days?: number | null;
          start_date: string;
          instructions?: string | null;
          status?: Database["public"]["Enums"]["prescription_status"];
          version?: number;
          idempotency_key: string;
          last_evaluated_version?: number | null;
          signed_by?: string | null;
          signed_at?: string | null;
          cancelled_by?: string | null;
          cancelled_at?: string | null;
          cancel_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prescriptions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "prescriptions_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_medication_id_fkey";
            columns: ["medication_id"];
            isOneToOne: false;
            referencedRelation: "medications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescriptions_prescriber_id_fkey";
            columns: ["prescriber_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      prescription_alerts: {
        Row: {
          id: string;
          prescription_id: string;
          prescription_version: number;
          rule_id: string;
          severity: Database["public"]["Enums"]["alert_severity"];
          message: string;
          allergy_id: string | null;
          patient_medication_id: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          prescription_id: string;
          prescription_version: number;
          rule_id: string;
          severity: Database["public"]["Enums"]["alert_severity"];
          message: string;
          allergy_id?: string | null;
          patient_medication_id?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prescription_alerts"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "prescription_alerts_prescription_id_fkey";
            columns: ["prescription_id"];
            isOneToOne: false;
            referencedRelation: "prescriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "prescription_alerts_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "interaction_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      prescription_safety_decisions: {
        Row: {
          id: string;
          alert_id: string;
          decided_by: string;
          decision: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          alert_id: string;
          decided_by: string;
          decision?: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prescription_safety_decisions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "prescription_safety_decisions_alert_id_fkey";
            columns: ["alert_id"];
            isOneToOne: true;
            referencedRelation: "prescription_alerts";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_set_team_membership: {
        Args: { p_care_team_id: string; p_profile_id: string; p_is_member: boolean };
        Returns: undefined;
      };
      admin_assign_patient_team: {
        Args: { p_patient_id: string; p_care_team_id: string };
        Returns: undefined;
      };
      log_patient_access: {
        Args: { p_patient_id: string };
        Returns: undefined;
      };
      admin_list_audit_events: {
        Args: { p_limit?: number; p_before_id?: number | null };
        Returns: {
          id: number;
          occurred_at: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          action: string;
          entity_type: string;
          entity_id: string;
          patient_id: string | null;
          metadata: Json;
        }[];
      };
      evaluate_prescription_safety: {
        Args: { p_prescription_id: string };
        Returns: Json;
      };
      acknowledge_prescription_alert: {
        Args: { p_alert_id: string; p_reason?: string | null };
        Returns: string;
      };
      sign_prescription: {
        Args: { p_prescription_id: string; p_expected_version: number };
        Returns: Json;
      };
      cancel_prescription: {
        Args: { p_prescription_id: string; p_expected_version: number; p_reason?: string | null };
        Returns: Json;
      };
    };
    Enums: {
      app_role: "clinician" | "admin";
      record_status: "active" | "inactive" | "entered_in_error";
      allergy_severity: "mild" | "moderate" | "severe";
      prescription_status: "draft" | "signed" | "cancelled";
      alert_severity: "blocking" | "advisory";
      rule_type: "allergy_class" | "interaction_class";
      dose_unit: "mg" | "mcg" | "g" | "mL" | "tablet" | "capsule";
      medication_route: "oral" | "topical" | "inhaled" | "subcutaneous" | "intramuscular";
      dose_frequency:
        | "once_daily"
        | "twice_daily"
        | "three_times_daily"
        | "four_times_daily"
        | "every_8_hours"
        | "at_bedtime"
        | "as_needed";
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][T];
