export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      agents: {
        Row: {
          config: Json;
          created_at: string;
          id: string;
          is_active: boolean;
          model: string;
          name: string;
          system_prompt: string;
          temperature: number;
          type: "setter" | "booking" | "support";
          updated_at: string;
          workspace_id: string;
        };
      };
      agendas: {
        Row: {
          active: boolean;
          closed_dates: string[];
          created_at: string;
          description: string;
          google_calendar_id: string | null;
          google_sync_mode: "off" | "push" | "push_and_busy";
          id: string;
          is_default: boolean;
          max_days_ahead: number;
          min_notice_minutes: number;
          name: string;
          no_show_enabled: boolean;
          no_show_hours_after: number;
          no_show_message: string | null;
          no_show_template: string | null;
          reminder_enabled: boolean;
          reminder_hours_before: number;
          reminder_message: string | null;
          reminder_template: string | null;
          schedule: Json;
          services: Json;
          slot_step_minutes: number;
          timezone: string;
          updated_at: string;
          workspace_id: string;
        };
      };
      appointments: {
        Row: {
          agenda_id: string;
          confirmed_at: string | null;
          contact_id: string;
          conversation_id: string | null;
          created_at: string;
          created_by: "agent" | "operator" | "flow" | "import";
          ends_at: string;
          google_event_id: string | null;
          google_sync_pending: boolean;
          id: string;
          no_show_sent_at: string | null;
          notes: string | null;
          notices: Json;
          reminder_sent_at: string | null;
          service: string;
          starts_at: string;
          status: "scheduled" | "rescheduled" | "cancelled" | "completed" | "no_show";
          updated_at: string;
          workspace_id: string;
        };
      };
      contacts: {
        Row: {
          automation_labels: string[];
          company: string | null;
          created_at: string;
          custom_fields: Json;
          email: string | null;
          full_name: string | null;
          id: string;
          last_message_at: string | null;
          metadata: Json;
          messaging_status: "active" | "blocked";
          phone_e164: string;
          source: "whatsapp" | "manual" | "import" | "stripe" | null;
          stage_id: string | null;
          updated_at: string;
          workspace_id: string;
        };
      };
      crm_contact_activity: {
        Row: {
          actor: "agent" | "operator" | "flow" | "system" | "import" | "stripe";
          actor_user_id: string | null;
          contact_id: string;
          created_at: string;
          data: Json;
          id: string;
          kind: string;
          workspace_id: string;
        };
      };
      crm_contact_notes: {
        Row: {
          author_id: string | null;
          body: string;
          contact_id: string;
          created_at: string;
          id: string;
          updated_at: string;
          workspace_id: string;
        };
      };
      crm_contact_tags: {
        Row: {
          contact_id: string;
          created_at: string;
          tag_id: string;
          workspace_id: string;
        };
      };
      crm_contact_tasks: {
        Row: {
          assigned_to: string | null;
          completed_at: string | null;
          contact_id: string;
          created_at: string;
          created_by: "agent" | "operator" | "flow";
          detail: string | null;
          due_at: string | null;
          id: string;
          title: string;
          updated_at: string;
          workspace_id: string;
        };
      };
      crm_custom_fields: {
        Row: {
          active: boolean;
          ai_readable: boolean;
          created_at: string;
          id: string;
          key: string;
          label: string;
          options: Json;
          position: number;
          type:
            | "text"
            | "long_text"
            | "number"
            | "money"
            | "date"
            | "boolean"
            | "select"
            | "multi"
            | "phone"
            | "email"
            | "url";
          updated_at: string;
          workspace_id: string;
        };
      };
      crm_pipeline_stages: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          kind: "open" | "won" | "lost";
          name: string;
          position: number;
          updated_at: string;
          workspace_id: string;
        };
      };
      crm_tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
          workspace_id: string;
        };
      };
      flow_answer_reviews: {
        Row: {
          attempt_count: number;
          confidence: number | null;
          contact_id: string;
          conversation_id: string | null;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          field_key: string | null;
          flow_id: string;
          flow_run_id: string;
          human_decision_reason: string | null;
          id: string;
          model: string | null;
          normalized_answer: string | null;
          original_answer: string;
          post_review_attempts: number;
          question: string;
          status:
            | "accepted"
            | "approved_by_human"
            | "blocked"
            | "pending_human"
            | "rejected_by_ai"
            | "rejected_by_human";
          step_id: string;
          updated_at: string;
          validation_reason: string;
          workspace_id: string;
        };
        Insert: {
          attempt_count?: number;
          confidence?: number | null;
          contact_id: string;
          conversation_id?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          field_key?: string | null;
          flow_id: string;
          flow_run_id: string;
          human_decision_reason?: string | null;
          id?: string;
          model?: string | null;
          normalized_answer?: string | null;
          original_answer: string;
          post_review_attempts?: number;
          question: string;
          status?:
            | "accepted"
            | "approved_by_human"
            | "blocked"
            | "pending_human"
            | "rejected_by_ai"
            | "rejected_by_human";
          step_id: string;
          updated_at?: string;
          validation_reason: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["flow_answer_reviews"]["Insert"]>;
      };
      flow_events: {
        Row: {
          contact_id: string | null;
          conversation_id: string | null;
          created_at: string;
          error: string | null;
          event_type: string;
          flow_id: string | null;
          flow_run_id: string | null;
          id: string;
          payload: Json;
          status: "stored" | "error";
          workspace_id: string;
        };
        Insert: {
          contact_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error?: string | null;
          event_type: string;
          flow_id?: string | null;
          flow_run_id?: string | null;
          id?: string;
          payload?: Json;
          status?: "stored" | "error";
          workspace_id: string;
        };
        Update: {
          contact_id?: string | null;
          conversation_id?: string | null;
          created_at?: string;
          error?: string | null;
          event_type?: string;
          flow_id?: string | null;
          flow_run_id?: string | null;
          id?: string;
          payload?: Json;
          status?: "stored" | "error";
          workspace_id?: string;
        };
      };
      flow_runs: {
        Row: {
          answers: Json;
          completed_at: string | null;
          contact_id: string;
          conversation_id: string | null;
          current_step_id: string | null;
          flow_id: string;
          history: Json;
          id: string;
          last_error: string | null;
          started_at: string;
          status: "active" | "waiting" | "completed" | "paused" | "transferred" | "failed" | "review_pending" | "blocked";
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          answers?: Json;
          completed_at?: string | null;
          contact_id: string;
          conversation_id?: string | null;
          current_step_id?: string | null;
          flow_id: string;
          history?: Json;
          id?: string;
          last_error?: string | null;
          started_at?: string;
          status?: "active" | "waiting" | "completed" | "paused" | "transferred" | "failed" | "review_pending" | "blocked";
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          answers?: Json;
          completed_at?: string | null;
          contact_id?: string;
          conversation_id?: string | null;
          current_step_id?: string | null;
          flow_id?: string;
          history?: Json;
          id?: string;
          last_error?: string | null;
          started_at?: string;
          status?: "active" | "waiting" | "completed" | "paused" | "transferred" | "failed" | "review_pending" | "blocked";
          updated_at?: string;
          workspace_id?: string;
        };
      };
      flows: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          metrics: Json;
          name: string;
          status: "draft" | "active" | "paused" | "archived";
          steps: Json;
          trigger_config: Json;
          trigger_type: "first_inbound" | "keyword" | "tag" | "webhook" | "manual";
          updated_at: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string;
          id?: string;
          metrics?: Json;
          name: string;
          status?: "draft" | "active" | "paused" | "archived";
          steps?: Json;
          trigger_config?: Json;
          trigger_type?: "first_inbound" | "keyword" | "tag" | "webhook" | "manual";
          updated_at?: string;
          workspace_id: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          metrics?: Json;
          name?: string;
          status?: "draft" | "active" | "paused" | "archived";
          steps?: Json;
          trigger_config?: Json;
          trigger_type?: "first_inbound" | "keyword" | "tag" | "webhook" | "manual";
          updated_at?: string;
          workspace_id?: string;
        };
      };
      conversations: {
        Row: {
          agent_id: string | null;
          ai_enabled: boolean;
          assigned_user_id: string | null;
          channel: "whatsapp";
          contact_id: string;
          created_at: string;
          external_conversation_id: string | null;
          id: string;
          last_message_at: string | null;
          status: "open" | "pending_handoff" | "closed";
          updated_at: string;
          workspace_id: string;
        };
      };
      google_event_deletions: {
        Row: {
          attempts: number;
          calendar_id: string;
          created_at: string;
          google_event_id: string;
          id: string;
          last_error: string | null;
          updated_at: string;
          workspace_id: string;
        };
      };
      integrations: {
        Row: {
          connected_at: string | null;
          config: Json;
          created_at: string;
          id: string;
          last_error: string | null;
          provider: "ycloud" | "openai" | "gohighlevel" | "google_calendar";
          secret_ref: string | null;
          status: "pending" | "active" | "error" | "disabled";
          updated_at: string;
          workspace_id: string;
        };
      };
      integration_secrets: {
        Row: {
          ciphertext: string;
          created_at: string;
          id: string;
          kind: string;
          provider: "ycloud" | "openai" | "gohighlevel" | "google_calendar";
          updated_at: string;
          workspace_id: string;
        };
      };
      messages: {
        Row: {
          body: string | null;
          contact_id: string | null;
          conversation_id: string;
          cost_usd: number;
          created_at: string;
          direction: "inbound" | "outbound" | "internal";
          id: string;
          input_tokens: number;
          media_url: string | null;
          message_type: "text" | "audio" | "image" | "file" | "event";
          metadata: Json;
          output_tokens: number;
          provider_message_id: string | null;
          role: "user" | "assistant" | "human" | "system" | "tool";
          status: "stored" | "queued" | "sent" | "delivered" | "read" | "failed";
          workspace_id: string;
        };
      };
      offered_slots: {
        Row: {
          agenda_id: string;
          conversation_id: string;
          offered_at: string;
          starts_at: string;
          workspace_id: string;
        };
      };
      schedule_blocks: {
        Row: {
          agenda_id: string;
          created_at: string;
          ends_at: string;
          id: string;
          reason: string | null;
          starts_at: string;
          updated_at: string;
          workspace_id: string;
        };
      };
      usage_events: {
        Row: {
          agent_id: string | null;
          conversation_id: string | null;
          cost_usd: number;
          created_at: string;
          id: string;
          input_tokens: number;
          message_id: string | null;
          metadata: Json;
          model: string | null;
          output_tokens: number;
          provider: string;
          total_tokens: number;
          workspace_id: string;
        };
      };
      workspace_assets: {
        Row: {
          content: string;
          created_at: string;
          id: string;
          kind: "business_profile" | "tool" | "template" | "knowledge";
          metadata: Json;
          status: "draft" | "active" | "archived";
          title: string;
          updated_at: string;
          workspace_id: string;
        };
      };
      webhook_events: {
        Row: {
          created_at: string;
          error: string | null;
          event_type: string;
          external_id: string | null;
          id: string;
          payload: Json;
          provider: "ycloud";
          status: "stored" | "ignored" | "error";
          workspace_id: string | null;
        };
      };
      workspace_members: {
        Row: {
          created_at: string;
          id: string;
          role: "owner" | "admin" | "agent" | "viewer";
          user_id: string;
          workspace_id: string;
        };
      };
      workspaces: {
        Row: {
          company_code: string;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          onboarding_completed_at: string | null;
          onboarding_state: Json;
          slug: string;
          status: "active" | "paused" | "archived";
          updated_at: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Solo service_role. Errores con SQLSTATE propio: LVS01 slot_taken,
      // LVN01 not_offered, LVH01 outside_hours, LVB01 blocked,
      // LVW01 wrong_workspace, LVA01 agenda_inactive, LVX01 not_active.
      book_appointment: {
        Args: {
          p_actor_user_id?: string | null;
          p_agenda_id: string;
          p_contact_id: string;
          p_conversation_id: string | null;
          p_created_by: "agent" | "operator" | "flow" | "import";
          p_ends_at: string;
          p_notes?: string | null;
          p_service: string;
          p_starts_at: string;
          p_workspace_id: string;
        };
        Returns: Database["public"]["Tables"]["appointments"]["Row"];
      };
      reschedule_appointment: {
        Args: {
          p_actor_user_id?: string | null;
          p_appointment_id: string;
          p_conversation_id?: string | null;
          p_created_by: "agent" | "operator" | "flow" | "import";
          p_ends_at: string;
          p_starts_at: string;
          p_workspace_id: string;
        };
        Returns: Database["public"]["Tables"]["appointments"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
