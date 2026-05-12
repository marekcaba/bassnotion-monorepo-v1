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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      assessment_config: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string | null
          questions: Json
          skill_thresholds: Json
          updated_at: string | null
          updated_by: string | null
          video_hash: string | null
          video_id: string
          video_library_id: string | null
          video_platform: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          questions?: Json
          skill_thresholds?: Json
          updated_at?: string | null
          updated_by?: string | null
          video_hash?: string | null
          video_id: string
          video_library_id?: string | null
          video_platform?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          questions?: Json
          skill_thresholds?: Json
          updated_at?: string | null
          updated_by?: string | null
          video_hash?: string | null
          video_id?: string
          video_library_id?: string | null
          video_platform?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_config_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_flow_edges: {
        Row: {
          condition_type: string
          condition_value: Json | null
          created_at: string | null
          from_node_id: string
          id: string
          label: string | null
          priority: number | null
          to_node_id: string
        }
        Insert: {
          condition_type: string
          condition_value?: Json | null
          created_at?: string | null
          from_node_id: string
          id?: string
          label?: string | null
          priority?: number | null
          to_node_id: string
        }
        Update: {
          condition_type?: string
          condition_value?: Json | null
          created_at?: string | null
          from_node_id?: string
          id?: string
          label?: string | null
          priority?: number | null
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_flow_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "assessment_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_flow_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "assessment_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_flow_nodes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_entry_point: boolean | null
          node_id: string
          node_type: string
          position_x: number | null
          position_y: number | null
          question_key: string | null
          segment_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_entry_point?: boolean | null
          node_id: string
          node_type: string
          position_x?: number | null
          position_y?: number | null
          question_key?: string | null
          segment_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_entry_point?: boolean | null
          node_id?: string
          node_type?: string
          position_x?: number | null
          position_y?: number | null
          question_key?: string | null
          segment_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_flow_nodes_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "assessment_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_questions: {
        Row: {
          audio_config: Json | null
          category: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          options: Json | null
          points: number | null
          question_key: string
          question_text: string
          question_type: string
          sort_order: number | null
          updated_at: string | null
          verification_config: Json | null
        }
        Insert: {
          audio_config?: Json | null
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json | null
          points?: number | null
          question_key: string
          question_text: string
          question_type: string
          sort_order?: number | null
          updated_at?: string | null
          verification_config?: Json | null
        }
        Update: {
          audio_config?: Json | null
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          options?: Json | null
          points?: number | null
          question_key?: string
          question_text?: string
          question_type?: string
          sort_order?: number | null
          updated_at?: string | null
          verification_config?: Json | null
        }
        Relationships: []
      }
      assessment_segments: {
        Row: {
          created_at: string | null
          description: string | null
          duration_seconds: number | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          sort_order: number | null
          target_buckets: string[] | null
          topic: string
          updated_at: string | null
          video_id: string
          video_library_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          sort_order?: number | null
          target_buckets?: string[] | null
          topic: string
          updated_at?: string | null
          video_id: string
          video_library_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          sort_order?: number | null
          target_buckets?: string[] | null
          topic?: string
          updated_at?: string | null
          video_id?: string
          video_library_id?: string
        }
        Relationships: []
      }
      coach_insight_templates: {
        Row: {
          coach_avatar_url: string | null
          coach_name: string | null
          created_at: string | null
          cta_link: string | null
          cta_text: string | null
          day1_description: string | null
          day1_title: string | null
          day2_description: string | null
          day2_title: string | null
          day3_description: string | null
          day3_title: string | null
          id: string
          insight_body: string
          insight_title: string
          is_active: boolean | null
          priority: number | null
          skill_check_acknowledgment: string | null
          target_bucket: string
          target_goal: string | null
          target_practice_time: string | null
          target_struggle: string | null
          updated_at: string | null
        }
        Insert: {
          coach_avatar_url?: string | null
          coach_name?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          day1_description?: string | null
          day1_title?: string | null
          day2_description?: string | null
          day2_title?: string | null
          day3_description?: string | null
          day3_title?: string | null
          id?: string
          insight_body: string
          insight_title: string
          is_active?: boolean | null
          priority?: number | null
          skill_check_acknowledgment?: string | null
          target_bucket: string
          target_goal?: string | null
          target_practice_time?: string | null
          target_struggle?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_avatar_url?: string | null
          coach_name?: string | null
          created_at?: string | null
          cta_link?: string | null
          cta_text?: string | null
          day1_description?: string | null
          day1_title?: string | null
          day2_description?: string | null
          day2_title?: string | null
          day3_description?: string | null
          day3_title?: string | null
          id?: string
          insight_body?: string
          insight_title?: string
          is_active?: boolean | null
          priority?: number | null
          skill_check_acknowledgment?: string | null
          target_bucket?: string
          target_goal?: string | null
          target_practice_time?: string | null
          target_struggle?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      creator_stats: {
        Row: {
          channel_id: string | null
          channel_url: string
          created_at: string | null
          creator_name: string
          id: string
          last_fetched_at: string | null
          subscriber_count: number | null
          subscriber_count_formatted: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_url: string
          created_at?: string | null
          creator_name: string
          id?: string
          last_fetched_at?: string | null
          subscriber_count?: number | null
          subscriber_count_formatted?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_url?: string
          created_at?: string | null
          creator_name?: string
          id?: string
          last_fetched_at?: string | null
          subscriber_count?: number | null
          subscriber_count_formatted?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      custom_basslines: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          description: string | null
          exercise_id: string
          id: string
          metadata: Json | null
          name: string
          notes: Json
          updated_at: string | null
          user_id: string
          version: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          exercise_id: string
          id?: string
          metadata?: Json | null
          name: string
          notes?: Json
          updated_at?: string | null
          user_id: string
          version?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          exercise_id?: string
          id?: string
          metadata?: Json | null
          name?: string
          notes?: Json
          updated_at?: string | null
          user_id?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_basslines_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_basslines_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises_with_runtime"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_favorites: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_favorites_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_favorites_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises_with_runtime"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_likes: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_likes_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_likes_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises_with_runtime"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          bassline_midi_url: string | null
          bpm: number
          chord_progression: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["exercise_difficulty"]
          drum_pattern: Json | null
          drummer_midi_url: string | null
          duration: number
          duration_beats: number | null
          file_size: number | null
          fretboard_view_config: Json | null
          harmony_control_changes: Json | null
          harmony_instrument: string | null
          harmony_midi_url: string | null
          harmony_notes: Json | null
          harmony_voicing: Json | null
          has_bass_midi: boolean | null
          has_drums_midi: boolean | null
          has_harmony_midi: boolean | null
          has_metronome_midi: boolean | null
          id: string
          is_active: boolean | null
          key: string | null
          key_signature: string
          like_count: number
          metronome_midi_url: string | null
          midi_file_path: string | null
          mix_settings: Json
          musical_content: Json
          notes: Json
          order_index: number | null
          original_filename: string | null
          tags: string[] | null
          tempo: number
          time_signature: Json | null
          title: string
          total_bars: number
          track_configuration: Json | null
          tutorial_id: string | null
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          bassline_midi_url?: string | null
          bpm?: number
          chord_progression?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty: Database["public"]["Enums"]["exercise_difficulty"]
          drum_pattern?: Json | null
          drummer_midi_url?: string | null
          duration: number
          duration_beats?: number | null
          file_size?: number | null
          fretboard_view_config?: Json | null
          harmony_control_changes?: Json | null
          harmony_instrument?: string | null
          harmony_midi_url?: string | null
          harmony_notes?: Json | null
          harmony_voicing?: Json | null
          has_bass_midi?: boolean | null
          has_drums_midi?: boolean | null
          has_harmony_midi?: boolean | null
          has_metronome_midi?: boolean | null
          id?: string
          is_active?: boolean | null
          key?: string | null
          key_signature?: string
          like_count?: number
          metronome_midi_url?: string | null
          midi_file_path?: string | null
          mix_settings?: Json
          musical_content?: Json
          notes?: Json
          order_index?: number | null
          original_filename?: string | null
          tags?: string[] | null
          tempo?: number
          time_signature?: Json | null
          title: string
          total_bars?: number
          track_configuration?: Json | null
          tutorial_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          bassline_midi_url?: string | null
          bpm?: number
          chord_progression?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["exercise_difficulty"]
          drum_pattern?: Json | null
          drummer_midi_url?: string | null
          duration?: number
          duration_beats?: number | null
          file_size?: number | null
          fretboard_view_config?: Json | null
          harmony_control_changes?: Json | null
          harmony_instrument?: string | null
          harmony_midi_url?: string | null
          harmony_notes?: Json | null
          harmony_voicing?: Json | null
          has_bass_midi?: boolean | null
          has_drums_midi?: boolean | null
          has_harmony_midi?: boolean | null
          has_metronome_midi?: boolean | null
          id?: string
          is_active?: boolean | null
          key?: string | null
          key_signature?: string
          like_count?: number
          metronome_midi_url?: string | null
          midi_file_path?: string | null
          mix_settings?: Json
          musical_content?: Json
          notes?: Json
          order_index?: number | null
          original_filename?: string | null
          tags?: string[] | null
          tempo?: number
          time_signature?: Json | null
          title?: string
          total_bars?: number
          track_configuration?: Json | null
          tutorial_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_journeys: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          estimated_weeks: number | null
          icon_url: string | null
          id: string
          is_active: boolean
          is_featured: boolean | null
          milestones: Json
          name: string
          slug: string
          target_genres: string[] | null
          target_goals: string[] | null
          target_skill_level: string | null
          target_techniques: string[] | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          estimated_weeks?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          milestones?: Json
          name: string
          slug: string
          target_genres?: string[] | null
          target_goals?: string[] | null
          target_skill_level?: string | null
          target_techniques?: string[] | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          estimated_weeks?: number | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean | null
          milestones?: Json
          name?: string
          slug?: string
          target_genres?: string[] | null
          target_goals?: string[] | null
          target_skill_level?: string | null
          target_techniques?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          created_at: string
          email: string
          id: string
          ip_address: unknown
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          created_at?: string
          email: string
          id?: string
          ip_address: unknown
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      pattern_library: {
        Row: {
          bars: number | null
          bpm_max: number | null
          bpm_min: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          drum_hits: Json | null
          duration_ms: number | null
          file_size_bytes: number | null
          genre: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          is_featured: boolean | null
          metadata: Json | null
          midi_file_path: string | null
          midi_file_url: string | null
          name: string
          preview_url: string | null
          slug: string
          tags: string[] | null
          time_signature: string | null
          type: string
          updated_at: string | null
          uploaded_at: string | null
          uploaded_by: string | null
          usage_count: number | null
          verified: boolean | null
        }
        Insert: {
          bars?: number | null
          bpm_max?: number | null
          bpm_min?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          drum_hits?: Json | null
          duration_ms?: number | null
          file_size_bytes?: number | null
          genre?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_featured?: boolean | null
          metadata?: Json | null
          midi_file_path?: string | null
          midi_file_url?: string | null
          name: string
          preview_url?: string | null
          slug: string
          tags?: string[] | null
          time_signature?: string | null
          type: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          verified?: boolean | null
        }
        Update: {
          bars?: number | null
          bpm_max?: number | null
          bpm_min?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          drum_hits?: Json | null
          duration_ms?: number | null
          file_size_bytes?: number | null
          genre?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          is_featured?: boolean | null
          metadata?: Json | null
          midi_file_path?: string | null
          midi_file_url?: string | null
          name?: string
          preview_url?: string | null
          slug?: string
          tags?: string[] | null
          time_signature?: string | null
          type?: string
          updated_at?: string | null
          uploaded_at?: string | null
          uploaded_by?: string | null
          usage_count?: number | null
          verified?: boolean | null
        }
        Relationships: []
      }
      pattern_uploads: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          file_name: string
          id: string
          mime_type: string | null
          pattern_id: string | null
          upload_status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name: string
          id?: string
          mime_type?: string | null
          pattern_id?: string | null
          upload_status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          file_name?: string
          id?: string
          mime_type?: string | null
          pattern_id?: string | null
          upload_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_uploads_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: false
            referencedRelation: "pattern_library"
            referencedColumns: ["id"]
          },
        ]
      }
      pattern_usage_stats: {
        Row: {
          average_session_duration: number | null
          last_used_at: string | null
          pattern_id: string
          usage_count: number | null
        }
        Insert: {
          average_session_duration?: number | null
          last_used_at?: string | null
          pattern_id: string
          usage_count?: number | null
        }
        Update: {
          average_session_duration?: number | null
          last_used_at?: string | null
          pattern_id?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pattern_usage_stats_pattern_id_fkey"
            columns: ["pattern_id"]
            isOneToOne: true
            referencedRelation: "pattern_library"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_progress: {
        Row: {
          completion_count: number
          exercise_id: string
          id: string
          last_tempo_bpm: number | null
          tutorial_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_count?: number
          exercise_id: string
          id?: string
          last_tempo_bpm?: number | null
          tutorial_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_count?: number
          exercise_id?: string
          id?: string
          last_tempo_bpm?: number | null
          tutorial_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "practice_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assessment_completed: boolean
          assessment_completed_at: string | null
          assessment_score: number | null
          avatar_url: string | null
          bass_max_frets: number | null
          bass_string_count: number | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          learning_style: string | null
          level_bucket: string | null
          location: string | null
          practice_streak_days: number | null
          preferred_genres: string[] | null
          preferred_techniques: string[] | null
          primary_goal: string | null
          provider: string | null
          role: string
          skill_level: string | null
          social_links: Json | null
          updated_at: string
          zero_mission_completed: boolean | null
        }
        Insert: {
          assessment_completed?: boolean
          assessment_completed_at?: string | null
          assessment_score?: number | null
          avatar_url?: string | null
          bass_max_frets?: number | null
          bass_string_count?: number | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          learning_style?: string | null
          level_bucket?: string | null
          location?: string | null
          practice_streak_days?: number | null
          preferred_genres?: string[] | null
          preferred_techniques?: string[] | null
          primary_goal?: string | null
          provider?: string | null
          role?: string
          skill_level?: string | null
          social_links?: Json | null
          updated_at?: string
          zero_mission_completed?: boolean | null
        }
        Update: {
          assessment_completed?: boolean
          assessment_completed_at?: string | null
          assessment_score?: number | null
          avatar_url?: string | null
          bass_max_frets?: number | null
          bass_string_count?: number | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          learning_style?: string | null
          level_bucket?: string | null
          location?: string | null
          practice_streak_days?: number | null
          preferred_genres?: string[] | null
          preferred_techniques?: string[] | null
          primary_goal?: string | null
          provider?: string | null
          role?: string
          skill_level?: string | null
          social_links?: Json | null
          updated_at?: string
          zero_mission_completed?: boolean | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          course_type: string
          created_at: string
          currency: string
          id: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          course_type: string
          created_at?: string
          currency?: string
          id?: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_payment_intent_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          course_type?: string
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_customer_id?: string
          stripe_payment_intent_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end: string
          current_period_start: string
          id?: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          revoked: boolean | null
          token_type: string
          token_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          revoked?: boolean | null
          token_type: string
          token_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          revoked?: boolean | null
          token_type?: string
          token_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tutorial_pattern_config: {
        Row: {
          allow_pattern_switching: boolean | null
          allowed_drum_patterns: string[] | null
          allowed_harmony_patterns: string[] | null
          created_at: string | null
          default_drum_pattern_id: string | null
          default_harmony_pattern_id: string | null
          id: string
          tutorial_id: string
          updated_at: string | null
        }
        Insert: {
          allow_pattern_switching?: boolean | null
          allowed_drum_patterns?: string[] | null
          allowed_harmony_patterns?: string[] | null
          created_at?: string | null
          default_drum_pattern_id?: string | null
          default_harmony_pattern_id?: string | null
          id?: string
          tutorial_id: string
          updated_at?: string | null
        }
        Update: {
          allow_pattern_switching?: boolean | null
          allowed_drum_patterns?: string[] | null
          allowed_harmony_patterns?: string[] | null
          created_at?: string | null
          default_drum_pattern_id?: string | null
          default_harmony_pattern_id?: string | null
          id?: string
          tutorial_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_pattern_config_default_drum_pattern_id_fkey"
            columns: ["default_drum_pattern_id"]
            isOneToOne: false
            referencedRelation: "pattern_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_pattern_config_default_harmony_pattern_id_fkey"
            columns: ["default_harmony_pattern_id"]
            isOneToOne: false
            referencedRelation: "pattern_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutorial_pattern_config_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: true
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorial_sections: {
        Row: {
          created_at: string | null
          end_time: number
          exercise_ids: string[] | null
          id: string
          order_index: number | null
          start_time: number
          title: string
          tutorial_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time: number
          exercise_ids?: string[] | null
          id?: string
          order_index?: number | null
          start_time: number
          title: string
          tutorial_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: number
          exercise_ids?: string[] | null
          id?: string
          order_index?: number | null
          start_time?: number
          title?: string
          tutorial_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tutorial_sections_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      tutorials: {
        Row: {
          artist: string | null
          author_name: string | null
          auto_save_version: number | null
          bassline_midi_url: string | null
          category: string | null
          concepts: string[] | null
          core_concept_description: string | null
          core_concept_points: Json | null
          created_at: string | null
          created_by: string | null
          creator_avatar_url: string | null
          creator_channel_url: string | null
          creator_name: string | null
          creator_subscriber_count: number | null
          deleted_at: string | null
          description: string | null
          difficulty: string | null
          drummer_midi_url: string | null
          duration: string | null
          harmony_midi_url: string | null
          headline: string | null
          id: string
          is_active: boolean | null
          last_modified: string | null
          order_index: number | null
          published_at: string | null
          rating: number | null
          slug: string
          status: Database["public"]["Enums"]["tutorial_status"] | null
          tags: string[] | null
          teaching_takeaway: Json | null
          thumbnail: string | null
          thumbnail_url: string | null
          title: string
          understand_headline: string | null
          understand_questions: Json | null
          understand_video_library_id: string | null
          understand_video_url: string | null
          updated_at: string | null
          view_count: number | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          artist?: string | null
          author_name?: string | null
          auto_save_version?: number | null
          bassline_midi_url?: string | null
          category?: string | null
          concepts?: string[] | null
          core_concept_description?: string | null
          core_concept_points?: Json | null
          created_at?: string | null
          created_by?: string | null
          creator_avatar_url?: string | null
          creator_channel_url?: string | null
          creator_name?: string | null
          creator_subscriber_count?: number | null
          deleted_at?: string | null
          description?: string | null
          difficulty?: string | null
          drummer_midi_url?: string | null
          duration?: string | null
          harmony_midi_url?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          last_modified?: string | null
          order_index?: number | null
          published_at?: string | null
          rating?: number | null
          slug: string
          status?: Database["public"]["Enums"]["tutorial_status"] | null
          tags?: string[] | null
          teaching_takeaway?: Json | null
          thumbnail?: string | null
          thumbnail_url?: string | null
          title: string
          understand_headline?: string | null
          understand_questions?: Json | null
          understand_video_library_id?: string | null
          understand_video_url?: string | null
          updated_at?: string | null
          view_count?: number | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          artist?: string | null
          author_name?: string | null
          auto_save_version?: number | null
          bassline_midi_url?: string | null
          category?: string | null
          concepts?: string[] | null
          core_concept_description?: string | null
          core_concept_points?: Json | null
          created_at?: string | null
          created_by?: string | null
          creator_avatar_url?: string | null
          creator_channel_url?: string | null
          creator_name?: string | null
          creator_subscriber_count?: number | null
          deleted_at?: string | null
          description?: string | null
          difficulty?: string | null
          drummer_midi_url?: string | null
          duration?: string | null
          harmony_midi_url?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean | null
          last_modified?: string | null
          order_index?: number | null
          published_at?: string | null
          rating?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["tutorial_status"] | null
          tags?: string[] | null
          teaching_takeaway?: Json | null
          thumbnail?: string | null
          thumbnail_url?: string | null
          title?: string
          understand_headline?: string | null
          understand_questions?: Json | null
          understand_video_library_id?: string | null
          understand_video_url?: string | null
          updated_at?: string | null
          view_count?: number | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      user_assessment_sessions: {
        Row: {
          answers: Json
          completed_at: string | null
          current_node_id: string | null
          determined_bucket: string | null
          id: string
          last_activity_at: string | null
          self_reported_level: string | null
          skill_check_passed: boolean | null
          skill_check_score: number | null
          started_at: string | null
          status: string | null
          user_id: string | null
          visited_node_ids: string[] | null
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          current_node_id?: string | null
          determined_bucket?: string | null
          id?: string
          last_activity_at?: string | null
          self_reported_level?: string | null
          skill_check_passed?: boolean | null
          skill_check_score?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
          visited_node_ids?: string[] | null
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          current_node_id?: string | null
          determined_bucket?: string | null
          id?: string
          last_activity_at?: string | null
          self_reported_level?: string | null
          skill_check_passed?: boolean | null
          skill_check_score?: number | null
          started_at?: string | null
          status?: string | null
          user_id?: string | null
          visited_node_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_assessment_sessions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "assessment_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assessment_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_journeys: {
        Row: {
          completed_at: string | null
          completed_milestones: number[] | null
          created_at: string
          current_milestone_index: number | null
          id: string
          journey_id: string
          progress: number | null
          started_at: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_milestones?: number[] | null
          created_at?: string
          current_milestone_index?: number | null
          id?: string
          journey_id: string
          progress?: number | null
          started_at?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_milestones?: number[] | null
          created_at?: string
          current_milestone_index?: number | null
          id?: string
          journey_id?: string
          progress?: number | null
          started_at?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_journeys_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "learning_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_journeys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pattern_selections: {
        Row: {
          last_used_at: string | null
          selected_drum_pattern_id: string | null
          selected_harmony_pattern_id: string | null
          tutorial_id: string
          user_id: string
        }
        Insert: {
          last_used_at?: string | null
          selected_drum_pattern_id?: string | null
          selected_harmony_pattern_id?: string | null
          tutorial_id: string
          user_id: string
        }
        Update: {
          last_used_at?: string | null
          selected_drum_pattern_id?: string | null
          selected_harmony_pattern_id?: string | null
          tutorial_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pattern_selections_selected_drum_pattern_id_fkey"
            columns: ["selected_drum_pattern_id"]
            isOneToOne: false
            referencedRelation: "pattern_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pattern_selections_selected_harmony_pattern_id_fkey"
            columns: ["selected_harmony_pattern_id"]
            isOneToOne: false
            referencedRelation: "pattern_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pattern_selections_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          default_bass_volume: number | null
          default_drums_volume: number | null
          default_harmony_volume: number | null
          default_metronome_sound: string | null
          default_metronome_volume: number | null
          default_subdivision: string | null
          default_tempo: number | null
          default_time_signature: string | null
          email_notifications_enabled: boolean | null
          fretboard_left_handed: boolean | null
          generation_tokens_balance: number | null
          id: string
          language: string | null
          notation_left_handed: boolean | null
          notifications_enabled: boolean | null
          practice_reminder_time: string | null
          theme: string | null
          updated_at: string
          user_id: string
          weekly_goal_minutes: number | null
        }
        Insert: {
          created_at?: string
          default_bass_volume?: number | null
          default_drums_volume?: number | null
          default_harmony_volume?: number | null
          default_metronome_sound?: string | null
          default_metronome_volume?: number | null
          default_subdivision?: string | null
          default_tempo?: number | null
          default_time_signature?: string | null
          email_notifications_enabled?: boolean | null
          fretboard_left_handed?: boolean | null
          generation_tokens_balance?: number | null
          id?: string
          language?: string | null
          notation_left_handed?: boolean | null
          notifications_enabled?: boolean | null
          practice_reminder_time?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
          weekly_goal_minutes?: number | null
        }
        Update: {
          created_at?: string
          default_bass_volume?: number | null
          default_drums_volume?: number | null
          default_harmony_volume?: number | null
          default_metronome_sound?: string | null
          default_metronome_volume?: number | null
          default_subdivision?: string | null
          default_tempo?: number | null
          default_time_signature?: string | null
          email_notifications_enabled?: boolean | null
          fretboard_left_handed?: boolean | null
          generation_tokens_balance?: number | null
          id?: string
          language?: string | null
          notation_left_handed?: boolean | null
          notifications_enabled?: boolean | null
          practice_reminder_time?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
          weekly_goal_minutes?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      exercises_with_runtime: {
        Row: {
          bpm: number | null
          chord_progression: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: Database["public"]["Enums"]["exercise_difficulty"] | null
          drum_pattern: Json | null
          duration: number | null
          duration_beats: number | null
          file_size: number | null
          harmony_voicing: Json | null
          id: string | null
          is_active: boolean | null
          key: string | null
          key_signature: string | null
          midi_file_path: string | null
          mix_settings: Json | null
          musical_content: Json | null
          notes: Json | null
          original_filename: string | null
          runtime_duration_ms: number | null
          runtime_duration_seconds: number | null
          tempo: number | null
          time_signature: Json | null
          title: string | null
          total_bars: number | null
          total_beats: number | null
          total_ticks: number | null
          track_configuration: Json | null
          tutorial_id: string | null
          updated_at: string | null
          uploaded_at: string | null
        }
        Insert: {
          bpm?: number | null
          chord_progression?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["exercise_difficulty"] | null
          drum_pattern?: Json | null
          duration?: number | null
          duration_beats?: number | null
          file_size?: number | null
          harmony_voicing?: Json | null
          id?: string | null
          is_active?: boolean | null
          key?: string | null
          key_signature?: string | null
          midi_file_path?: string | null
          mix_settings?: Json | null
          musical_content?: Json | null
          notes?: Json | null
          original_filename?: string | null
          runtime_duration_ms?: never
          runtime_duration_seconds?: never
          tempo?: number | null
          time_signature?: Json | null
          title?: string | null
          total_bars?: number | null
          total_beats?: never
          total_ticks?: never
          track_configuration?: Json | null
          tutorial_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Update: {
          bpm?: number | null
          chord_progression?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: Database["public"]["Enums"]["exercise_difficulty"] | null
          drum_pattern?: Json | null
          duration?: number | null
          duration_beats?: number | null
          file_size?: number | null
          harmony_voicing?: Json | null
          id?: string | null
          is_active?: boolean | null
          key?: string | null
          key_signature?: string | null
          midi_file_path?: string | null
          mix_settings?: Json | null
          musical_content?: Json | null
          notes?: Json | null
          original_filename?: string | null
          runtime_duration_ms?: never
          runtime_duration_seconds?: never
          tempo?: number | null
          time_signature?: Json | null
          title?: string | null
          total_bars?: number | null
          total_beats?: never
          total_ticks?: never
          track_configuration?: Json | null
          tutorial_id?: string | null
          updated_at?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_tutorial_id_fkey"
            columns: ["tutorial_id"]
            isOneToOne: false
            referencedRelation: "tutorials"
            referencedColumns: ["id"]
          },
        ]
      }
      fresh_creator_stats: {
        Row: {
          channel_id: string | null
          channel_url: string | null
          created_at: string | null
          creator_name: string | null
          id: string | null
          last_fetched_at: string | null
          subscriber_count: number | null
          subscriber_count_formatted: string | null
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_url?: string | null
          created_at?: string | null
          creator_name?: string | null
          id?: string | null
          last_fetched_at?: string | null
          subscriber_count?: number | null
          subscriber_count_formatted?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_url?: string | null
          created_at?: string | null
          creator_name?: string | null
          id?: string | null
          last_fetched_at?: string | null
          subscriber_count?: number | null
          subscriber_count_formatted?: string | null
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_save_bassline: {
        Args: {
          p_bassline_id?: string
          p_metadata?: Json
          p_name: string
          p_notes: Json
          p_user_id: string
        }
        Returns: string
      }
      calculate_exercise_runtime: {
        Args: { beats: number; bpm: number }
        Returns: number
      }
      check_user_exists: { Args: { email_input: string }; Returns: boolean }
      cleanup_expired_temp_midi_files: { Args: never; Returns: undefined }
      duplicate_bassline: {
        Args: {
          p_bassline_id: string
          p_include_description?: boolean
          p_new_name: string
          p_user_id: string
        }
        Returns: string
      }
      generate_slug: { Args: { title: string }; Returns: string }
      get_pattern_storage_url: {
        Args: { pattern_path: string }
        Returns: string
      }
      get_tutorials_with_exercise_count: {
        Args: never
        Returns: {
          artist: string
          concepts: string[]
          created_at: string
          description: string
          difficulty: string
          duration: string
          exercise_count: number
          id: string
          is_active: boolean
          rating: number
          slug: string
          thumbnail: string
          title: string
          understand_headline: string
          understand_questions: Json
          understand_video_library_id: string
          understand_video_url: string
          updated_at: string
          youtube_url: string
        }[]
      }
      get_user_role: { Args: never; Returns: string }
      has_completed_assessment: { Args: { user_id: string }; Returns: boolean }
      has_role: { Args: { required_role: string }; Returns: boolean }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      migrate_all_exercises_to_musical_timing: {
        Args: never
        Returns: {
          exercise_id: string
          exercise_title: string
          note_count: number
          status: string
        }[]
      }
      migrate_exercise_to_musical_timing: {
        Args: { exercise_id: string }
        Returns: undefined
      }
      ms_to_musical_duration: {
        Args: { bpm?: number; duration_ms: number }
        Returns: string
      }
      ms_to_musical_position: {
        Args: { bpm?: number; time_sig: Json; timestamp_ms: number }
        Returns: Json
      }
      musical_time_to_milliseconds: {
        Args: {
          bars: number
          beats: number
          subdivision: number
          tempo: number
          time_signature?: Json
        }
        Returns: number
      }
      soft_delete_bassline: {
        Args: { p_bassline_id: string; p_user_id: string }
        Returns: boolean
      }
      tick_to_milliseconds: {
        Args: { resolution?: number; tempo: number; tick: number }
        Returns: number
      }
      validate_epic4_note_properties: {
        Args: { note_json: Json }
        Returns: boolean
      }
      validate_exercise_notes: {
        Args: { exercise_id: string }
        Returns: {
          error_message: string
          is_valid: boolean
          note_index: number
        }[]
      }
      validate_musical_timing_migration: {
        Args: never
        Returns: {
          exercise_id: string
          exercise_title: string
          has_musical_timing: boolean
          note_count: number
        }[]
      }
    }
    Enums: {
      exercise_difficulty: "beginner" | "intermediate" | "advanced"
      tutorial_status: "draft" | "published" | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      exercise_difficulty: ["beginner", "intermediate", "advanced"],
      tutorial_status: ["draft", "published", "archived"],
    },
  },
} as const
