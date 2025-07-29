export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      habits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: 'book' | 'running' | 'ai_learning' | 'job_search' | 'swimming' | 'weight' | 'exercise';
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: 'book' | 'running' | 'ai_learning' | 'job_search' | 'swimming' | 'weight' | 'exercise';
          color: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: 'book' | 'running' | 'ai_learning' | 'job_search' | 'swimming' | 'weight' | 'exercise';
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      habit_completions: {
        Row: {
          id: string;
          user_id: string;
          habit_id: string;
          date: string;
          data: any; // JSON data specific to habit type
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          habit_id: string;
          date: string;
          data: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          habit_id?: string;
          date?: string;
          data?: any;
          created_at?: string;
          updated_at?: string;
        };
      };
      books: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          total_pages: number;
          finished_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          total_pages: number;
          finished_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          total_pages?: number;
          finished_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}