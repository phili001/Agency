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
      contacts: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          metadata: Json;
          phone_e164: string;
          updated_at: string;
          workspace_id: string;
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
      integrations: {
        Row: {
          connected_at: string | null;
          config: Json;
          created_at: string;
          id: string;
          last_error: string | null;
          provider: "ycloud" | "openai" | "gohighlevel";
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
          provider: "ycloud" | "openai" | "gohighlevel";
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
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
