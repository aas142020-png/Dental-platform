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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      block_claims: {
        Row: {
          anchor: string
          block_id: string
          claim_id: string
        }
        Insert: {
          anchor?: string
          block_id: string
          claim_id: string
        }
        Update: {
          anchor?: string
          block_id?: string
          claim_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "block_claims_block_id_fkey"
            columns: ["block_id"]
            isOneToOne: false
            referencedRelation: "topic_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "block_claims_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      case_topics: {
        Row: {
          case_id: string
          topic_id: string
        }
        Insert: {
          case_id: string
          topic_id: string
        }
        Update: {
          case_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_topics_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["topic_id"]
          },
          {
            foreignKeyName: "case_topics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      case_version_claims: {
        Row: {
          case_version_id: string
          claim_id: string
        }
        Insert: {
          case_version_id: string
          claim_id: string
        }
        Update: {
          case_version_id?: string
          claim_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_version_claims_case_version_id_fkey"
            columns: ["case_version_id"]
            isOneToOne: false
            referencedRelation: "case_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_version_claims_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      case_version_locales: {
        Row: {
          case_version_id: string
          is_published: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          published_at: string
        }
        Insert: {
          case_version_id: string
          is_published?: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          published_at?: string
        }
        Update: {
          case_version_id?: string
          is_published?: boolean
          locale?: Database["public"]["Enums"]["locale_code"]
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_version_locales_case_version_id_fkey"
            columns: ["case_version_id"]
            isOneToOne: false
            referencedRelation: "case_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      case_versions: {
        Row: {
          based_on_id: string | null
          case_id: string
          change_note: string | null
          content: Json
          created_at: string
          created_by: string | null
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          published_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          title: Json
          updated_at: string
          version_no: number
        }
        Insert: {
          based_on_id?: string | null
          case_id: string
          change_note?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: Json
          updated_at?: string
          version_no: number
        }
        Update: {
          based_on_id?: string | null
          case_id?: string
          change_note?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          title?: Json
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_versions_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "case_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_versions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          created_by: string | null
          id: string
          published_version_id: string | null
          slug: string | null
          specialty_id: string | null
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          created_by?: string | null
          id?: string
          published_version_id?: string | null
          slug?: string | null
          specialty_id?: string | null
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          created_by?: string | null
          id?: string
          published_version_id?: string | null
          slug?: string | null
          specialty_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "case_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["specialty_id"]
          },
        ]
      }
      claim_sources: {
        Row: {
          claim_id: string
          created_at: string
          created_by: string | null
          locator: string
          source_id: string
          support: Database["public"]["Enums"]["support_level"]
          supporting_passage: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          created_by?: string | null
          locator: string
          source_id: string
          support?: Database["public"]["Enums"]["support_level"]
          supporting_passage: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          created_by?: string | null
          locator?: string
          source_id?: string
          support?: Database["public"]["Enums"]["support_level"]
          supporting_passage?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_sources_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "v_flagged_sources"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "claim_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "v_source_impact"
            referencedColumns: ["source_id"]
          },
          {
            foreignKeyName: "claim_sources_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          specialty_id: string | null
          statement: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          specialty_id?: string | null
          statement: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          specialty_id?: string | null
          statement?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["specialty_id"]
          },
        ]
      }
      editorial_policy: {
        Row: {
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "editorial_policy_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt: Json
          bucket: string
          caption: Json
          created_at: string
          credit: string | null
          duration_s: number | null
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          license: string | null
          mime_type: string | null
          origin: Database["public"]["Enums"]["content_origin"]
          review_status: Database["public"]["Enums"]["media_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          storage_path: string
          updated_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt?: Json
          bucket?: string
          caption?: Json
          created_at?: string
          credit?: string | null
          duration_s?: number | null
          height?: number | null
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          license?: string | null
          mime_type?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          review_status?: Database["public"]["Enums"]["media_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt?: Json
          bucket?: string
          caption?: Json
          created_at?: string
          credit?: string | null
          duration_s?: number | null
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          license?: string | null
          mime_type?: string | null
          origin?: Database["public"]["Enums"]["content_origin"]
          review_status?: Database["public"]["Enums"]["media_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          institution: string | null
          onboarded_at: string | null
          preferred_locale: Database["public"]["Enums"]["locale_code"]
          role: Database["public"]["Enums"]["user_role"] | null
          specialty_interest: string | null
          study_level: Database["public"]["Enums"]["study_level"] | null
          study_year: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          institution?: string | null
          onboarded_at?: string | null
          preferred_locale?: Database["public"]["Enums"]["locale_code"]
          role?: Database["public"]["Enums"]["user_role"] | null
          specialty_interest?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          study_year?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          institution?: string | null
          onboarded_at?: string | null
          preferred_locale?: Database["public"]["Enums"]["locale_code"]
          role?: Database["public"]["Enums"]["user_role"] | null
          specialty_interest?: string | null
          study_level?: Database["public"]["Enums"]["study_level"] | null
          study_year?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      question_version_claims: {
        Row: {
          claim_id: string
          question_version_id: string
        }
        Insert: {
          claim_id: string
          question_version_id: string
        }
        Update: {
          claim_id?: string
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_version_claims_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_version_claims_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_version_locales: {
        Row: {
          is_published: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          published_at: string
          question_version_id: string
        }
        Insert: {
          is_published?: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          published_at?: string
          question_version_id: string
        }
        Update: {
          is_published?: boolean
          locale?: Database["public"]["Enums"]["locale_code"]
          published_at?: string
          question_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_version_locales_question_version_id_fkey"
            columns: ["question_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_versions: {
        Row: {
          based_on_id: string | null
          change_note: string | null
          created_at: string
          created_by: string | null
          difficulty: number | null
          explanation: Json
          id: string
          kind: string
          options: Json
          origin: Database["public"]["Enums"]["content_origin"]
          published_at: string | null
          question_id: string
          status: Database["public"]["Enums"]["content_status"]
          stem: Json
          updated_at: string
          version_no: number
        }
        Insert: {
          based_on_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          explanation?: Json
          id?: string
          kind?: string
          options?: Json
          origin?: Database["public"]["Enums"]["content_origin"]
          published_at?: string | null
          question_id: string
          status?: Database["public"]["Enums"]["content_status"]
          stem?: Json
          updated_at?: string
          version_no: number
        }
        Update: {
          based_on_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          difficulty?: number | null
          explanation?: Json
          id?: string
          kind?: string
          options?: Json
          origin?: Database["public"]["Enums"]["content_origin"]
          published_at?: string | null
          question_id?: string
          status?: Database["public"]["Enums"]["content_status"]
          stem?: Json
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_versions_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_versions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          created_at: string
          created_by: string | null
          id: string
          published_version_id: string | null
          topic_id: string | null
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          created_by?: string | null
          id?: string
          published_version_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          created_at?: string
          created_by?: string | null
          id?: string
          published_version_id?: string | null
          topic_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "question_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["topic_id"]
          },
          {
            foreignKeyName: "questions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          item_id: string
          item_type: string
          note: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          item_type: string
          note?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          item_type?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          authors: string | null
          created_at: string
          created_by: string | null
          doi: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id: string
          last_reviewed_at: string | null
          last_reviewed_by: string | null
          notes: string | null
          organization: string | null
          publication_date: string | null
          status: Database["public"]["Enums"]["source_status"]
          title: string
          updated_at: string
          url: string | null
          version_label: string | null
        }
        Insert: {
          authors?: string | null
          created_at?: string
          created_by?: string | null
          doi?: string | null
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          notes?: string | null
          organization?: string | null
          publication_date?: string | null
          status?: Database["public"]["Enums"]["source_status"]
          title: string
          updated_at?: string
          url?: string | null
          version_label?: string | null
        }
        Update: {
          authors?: string | null
          created_at?: string
          created_by?: string | null
          doi?: string | null
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          id?: string
          last_reviewed_at?: string | null
          last_reviewed_by?: string | null
          notes?: string | null
          organization?: string | null
          publication_date?: string | null
          status?: Database["public"]["Enums"]["source_status"]
          title?: string
          updated_at?: string
          url?: string | null
          version_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sources_last_reviewed_by_fkey"
            columns: ["last_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      specialties: {
        Row: {
          created_at: string
          description: Json
          icon_asset_id: string | null
          id: string
          is_active: boolean
          name: Json
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: Json
          icon_asset_id?: string | null
          id?: string
          is_active?: boolean
          name: Json
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: Json
          icon_asset_id?: string | null
          id?: string
          is_active?: boolean
          name?: Json
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "specialties_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_blocks: {
        Row: {
          content: Json
          created_at: string
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          position: number
          schema_version: number
          topic_version_id: string
          type: Database["public"]["Enums"]["block_type"]
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          position: number
          schema_version?: number
          topic_version_id: string
          type: Database["public"]["Enums"]["block_type"]
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          position?: number
          schema_version?: number
          topic_version_id?: string
          type?: Database["public"]["Enums"]["block_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_blocks_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "topic_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_blocks_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["working_version_id"]
          },
          {
            foreignKeyName: "topic_blocks_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["version_id"]
          },
        ]
      }
      topic_version_locales: {
        Row: {
          is_published: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          published_at: string
          topic_version_id: string
        }
        Insert: {
          is_published?: boolean
          locale: Database["public"]["Enums"]["locale_code"]
          published_at?: string
          topic_version_id: string
        }
        Update: {
          is_published?: boolean
          locale?: Database["public"]["Enums"]["locale_code"]
          published_at?: string
          topic_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_version_locales_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "topic_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_version_locales_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["working_version_id"]
          },
          {
            foreignKeyName: "topic_version_locales_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["version_id"]
          },
        ]
      }
      topic_versions: {
        Row: {
          based_on_id: string | null
          change_note: string | null
          created_at: string
          created_by: string | null
          est_minutes: number | null
          id: string
          origin: Database["public"]["Enums"]["content_origin"]
          published_at: string | null
          status: Database["public"]["Enums"]["content_status"]
          subtitle: Json
          title: Json
          topic_id: string
          updated_at: string
          version_no: number
        }
        Insert: {
          based_on_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          est_minutes?: number | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: Json
          title?: Json
          topic_id: string
          updated_at?: string
          version_no: number
        }
        Update: {
          based_on_id?: string | null
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          est_minutes?: number | null
          id?: string
          origin?: Database["public"]["Enums"]["content_origin"]
          published_at?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          subtitle?: Json
          title?: Json
          topic_id?: string
          updated_at?: string
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "topic_versions_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "topic_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_versions_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["working_version_id"]
          },
          {
            foreignKeyName: "topic_versions_based_on_id_fkey"
            columns: ["based_on_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "topic_versions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_versions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_versions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["topic_id"]
          },
          {
            foreignKeyName: "topic_versions_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["topic_id"]
          },
        ]
      }
      topics: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          audience: Database["public"]["Enums"]["user_role"][]
          created_at: string
          created_by: string | null
          id: string
          published_version_id: string | null
          slug: string
          sort_order: number
          specialty_id: string
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          audience?: Database["public"]["Enums"]["user_role"][]
          created_at?: string
          created_by?: string | null
          id?: string
          published_version_id?: string | null
          slug: string
          sort_order?: number
          specialty_id: string
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          audience?: Database["public"]["Enums"]["user_role"][]
          created_at?: string
          created_by?: string | null
          id?: string
          published_version_id?: string | null
          slug?: string
          sort_order?: number
          specialty_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "topic_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["working_version_id"]
          },
          {
            foreignKeyName: "topics_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "topics_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["specialty_id"]
          },
        ]
      }
      user_interests: {
        Row: {
          created_at: string
          specialty_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          specialty_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          specialty_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_interests_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_specialties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_interests_specialty_id_fkey"
            columns: ["specialty_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["specialty_id"]
          },
          {
            foreignKeyName: "user_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          completed_at: string | null
          last_block_id: string | null
          percent: number
          status: string
          topic_id: string
          topic_version_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          last_block_id?: string | null
          percent?: number
          status?: string
          topic_id: string
          topic_version_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          last_block_id?: string | null
          percent?: number
          status?: string
          topic_id?: string
          topic_version_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["topic_id"]
          },
          {
            foreignKeyName: "user_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["topic_id"]
          },
          {
            foreignKeyName: "user_progress_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "topic_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["working_version_id"]
          },
          {
            foreignKeyName: "user_progress_topic_version_id_fkey"
            columns: ["topic_version_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["version_id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          from_status: Database["public"]["Enums"]["content_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          from_status?: Database["public"]["Enums"]["content_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          from_status?: Database["public"]["Enums"]["content_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          from_status: Database["public"]["Enums"]["content_status"]
          is_review_step: boolean
          required_role: Database["public"]["Enums"]["staff_role"] | null
          requires_note: boolean
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["content_status"]
          is_review_step?: boolean
          required_role?: Database["public"]["Enums"]["staff_role"] | null
          requires_note?: boolean
          to_status: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["content_status"]
          is_review_step?: boolean
          required_role?: Database["public"]["Enums"]["staff_role"] | null
          requires_note?: boolean
          to_status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: []
      }
    }
    Views: {
      v_admin_topics: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"] | null
          last_change_at: string | null
          published_version_id: string | null
          sort_order: number | null
          specialty_slug: string | null
          title: Json | null
          topic_id: string | null
          topic_slug: string | null
          working_status: Database["public"]["Enums"]["content_status"] | null
          working_version_id: string | null
          working_version_no: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "topic_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "v_admin_topics"
            referencedColumns: ["working_version_id"]
          },
          {
            foreignKeyName: "topics_published_version_fk"
            columns: ["published_version_id"]
            isOneToOne: false
            referencedRelation: "v_topic_catalog"
            referencedColumns: ["version_id"]
          },
        ]
      }
      v_flagged_sources: {
        Row: {
          affected_claims: number | null
          affected_published_versions: number | null
          source_id: string | null
          source_status: Database["public"]["Enums"]["source_status"] | null
          source_title: string | null
          worst_severity: string | null
          worst_severity_rank: number | null
        }
        Relationships: []
      }
      v_source_impact: {
        Row: {
          claim_id: string | null
          claim_statement: Json | null
          content_id: string | null
          content_ref: string | null
          content_title: Json | null
          content_type: string | null
          link_support: Database["public"]["Enums"]["support_level"] | null
          locator: string | null
          remaining_active_direct_support: number | null
          severity: string | null
          severity_rank: number | null
          source_id: string | null
          source_status: Database["public"]["Enums"]["source_status"] | null
          source_title: string | null
          version_id: string | null
          version_no: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_sources_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      v_specialties: {
        Row: {
          description: Json | null
          icon_asset_id: string | null
          id: string | null
          is_active: boolean | null
          name: Json | null
          published_topic_count: number | null
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          description?: Json | null
          icon_asset_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: Json | null
          published_topic_count?: never
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          description?: Json | null
          icon_asset_id?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: Json | null
          published_topic_count?: never
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "specialties_icon_asset_id_fkey"
            columns: ["icon_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      v_topic_catalog: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"] | null
          audience: Database["public"]["Enums"]["user_role"][] | null
          available_locales: Database["public"]["Enums"]["locale_code"][] | null
          can_read: boolean | null
          est_minutes: number | null
          published_at: string | null
          sort_order: number | null
          specialty_id: string | null
          specialty_slug: string | null
          subtitle: Json | null
          title: Json | null
          topic_id: string | null
          topic_slug: string | null
          version_id: string | null
          version_no: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_case_draft: {
        Args: { p_case_id: string; p_change_note?: string }
        Returns: string
      }
      create_question_draft: {
        Args: { p_change_note?: string; p_question_id: string }
        Returns: string
      }
      create_topic_draft: {
        Args: { p_change_note?: string; p_topic_id: string }
        Returns: string
      }
      get_topic_bundle: {
        Args: { p_specialty_slug: string; p_topic_slug: string }
        Returns: Json
      }
      get_version_bundle: { Args: { p_version_id: string }; Returns: Json }
      reorder_blocks: {
        Args: { p_block_ids: string[]; p_version_id: string }
        Returns: undefined
      }
      transition_content: {
        Args: {
          p_entity_id: string
          p_entity_type: string
          p_note?: string
          p_to: Database["public"]["Enums"]["content_status"]
        }
        Returns: Database["public"]["Enums"]["content_status"]
      }
      upsert_progress: {
        Args: {
          p_completed?: boolean
          p_last_block_id?: string
          p_percent: number
          p_topic_id: string
        }
        Returns: {
          completed_at: string | null
          last_block_id: string | null
          percent: number
          status: string
          topic_id: string
          topic_version_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_progress"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      access_level: "public" | "authenticated" | "premium"
      block_type:
        | "summary"
        | "text"
        | "illustration"
        | "animation"
        | "interactive_diagram"
        | "comparison"
        | "clinical_pearl"
        | "warning"
        | "clinical_case"
        | "quiz"
        | "source_list"
      content_origin: "human" | "ai_assisted"
      content_status:
        | "draft"
        | "source_verified"
        | "clinical_review"
        | "visual_review"
        | "approved"
        | "published"
        | "archived"
      evidence_type:
        | "clinical_guideline"
        | "systematic_review"
        | "meta_analysis"
        | "rct"
        | "cohort"
        | "case_control"
        | "case_series"
        | "expert_consensus"
        | "position_statement"
        | "textbook"
        | "narrative_review"
        | "other"
      locale_code: "ar" | "en"
      media_kind: "image" | "svg" | "video" | "lottie" | "model3d"
      media_review_status: "pending" | "approved" | "rejected"
      source_status: "active" | "under_review" | "superseded" | "retracted"
      staff_role:
        | "editor"
        | "source_verifier"
        | "clinical_reviewer"
        | "visual_reviewer"
        | "admin"
      study_level:
        | "preclinical"
        | "clinical_year"
        | "intern"
        | "postgrad"
        | "practitioner"
      support_level: "direct" | "partial" | "contextual"
      user_role:
        | "student"
        | "intern"
        | "general_dentist"
        | "specialist"
        | "other"
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
      access_level: ["public", "authenticated", "premium"],
      block_type: [
        "summary",
        "text",
        "illustration",
        "animation",
        "interactive_diagram",
        "comparison",
        "clinical_pearl",
        "warning",
        "clinical_case",
        "quiz",
        "source_list",
      ],
      content_origin: ["human", "ai_assisted"],
      content_status: [
        "draft",
        "source_verified",
        "clinical_review",
        "visual_review",
        "approved",
        "published",
        "archived",
      ],
      evidence_type: [
        "clinical_guideline",
        "systematic_review",
        "meta_analysis",
        "rct",
        "cohort",
        "case_control",
        "case_series",
        "expert_consensus",
        "position_statement",
        "textbook",
        "narrative_review",
        "other",
      ],
      locale_code: ["ar", "en"],
      media_kind: ["image", "svg", "video", "lottie", "model3d"],
      media_review_status: ["pending", "approved", "rejected"],
      source_status: ["active", "under_review", "superseded", "retracted"],
      staff_role: [
        "editor",
        "source_verifier",
        "clinical_reviewer",
        "visual_reviewer",
        "admin",
      ],
      study_level: [
        "preclinical",
        "clinical_year",
        "intern",
        "postgrad",
        "practitioner",
      ],
      support_level: ["direct", "partial", "contextual"],
      user_role: [
        "student",
        "intern",
        "general_dentist",
        "specialist",
        "other",
      ],
    },
  },
} as const
