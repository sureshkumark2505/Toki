/**
 * Toki API Service Client
 * Seamlessly interfaces with the FastAPI Backend (http://localhost:8000).
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface BackendTurnReply {
  reply: string;
  correction?: string | null;
  explanation?: string | null;
  next_prompt?: string;
  speech_speed?: number;
}

export interface BackendSessionStart {
  session_id: number;
  opening: string;
}

export interface BackendSessionReport {
  session_id: number;
  summary: string;
  turn_count: number;
  scores: {
    fluency: number;
    grammar: number;
    vocabulary: number;
    clarity: number;
    confidence: number;
  };
  strengths: string[];
  key_corrections: Array<{
    original: string;
    correction: string;
    explanation: string;
  }>;
  vocabulary_captured: Array<{
    word: string;
    meaning: string;
    example: string;
  }>;
  recommended_exercise: string;
}

export interface BackendDailyPlan {
  id?: number;
  tasks: Array<{
    title: string;
    kind: string;
    minutes: number;
    instruction: string;
  }>;
  generated_reason: string;
  completed?: boolean;
}

export interface BackendVocabItem {
  id: number;
  word_or_phrase: string;
  meaning: string;
  example: string;
  learner_usage?: string;
  mastery: number;
  next_review?: string;
}

export interface BackendMistakeItem {
  id: number;
  category: string;
  original: string;
  correction: string;
  explanation: string;
  frequency: number;
  mastery: number;
  interval_days: number;
  next_review?: string;
}

export interface BackendProgressDashboard {
  user_id: number;
  speaking_minutes: number;
  streak_days: number;
  total_sessions: number;
  fluency_score: number;
  grammar_score: number;
  vocabulary_score: number;
  clarity_score: number;
  confidence_score: number;
  mastered_vocabulary_count: number;
  active_mistakes_count: number;
  recent_session_summaries: string[];
}

export interface BackendUserSettings {
  user_id?: number;
  name?: string;
  native_language?: string;
  explanation_language?: string;
  target_level?: string;
  speaking_pace?: string;
  daily_goal_mins?: number;
  voice_accent?: string;
  feedback_style?: string;
  corrections_strictness?: string;
  enable_haptics?: boolean;
}

export function formatReportToFeedbackData(
  report: BackendSessionReport,
  defaultTopic = 'Spoken English Practice'
): import('../types').SessionFeedbackData {
  const primaryCorrection = report.key_corrections?.[0];
  const improvementObj = primaryCorrection
    ? {
        focusTitle: primaryCorrection.explanation ? primaryCorrection.explanation.slice(0, 45) : 'Refined natural phrasing',
        category: 'Conversational nuance',
        insteadOf: primaryCorrection.original,
        wrongFragment: primaryCorrection.original.split(' ')[0] || primaryCorrection.original,
        trySaying: primaryCorrection.correction,
        correctFragment: primaryCorrection.correction.split(' ')[0] || primaryCorrection.correction,
        audioPronunciationText: primaryCorrection.correction,
      }
    : {
        focusTitle: 'Conversational Fluency',
        category: 'Flow & Precision',
        insteadOf: 'No major grammatical mistakes detected in this session.',
        wrongFragment: 'Clear',
        trySaying: 'Continue elaborating your thoughts with compound expressions.',
        correctFragment: 'Continue elaborating',
        audioPronunciationText: 'Continue elaborating your thoughts with compound expressions.',
      };

  return {
    sessionId: report.session_id,
    sessionTitle: defaultTopic,
    durationMinutes: Math.max(1, Math.round((report.turn_count || 1) * 0.8)),
    wordsExchanged: Math.max(30, (report.turn_count || 1) * 12),
    coachReflection:
      report.summary ||
      'Great natural speaking flow throughout the session. You expressed your ideas clearly and maintained steady conversational pacing!',
    strengths: (report.strengths && report.strengths.length > 0
      ? report.strengths
      : ['Natural conversational rhythm', 'Clear articulation', 'Confident response formulation']
    ).map((s) => ({
      title: s,
      description: 'Maintained smooth and effortless delivery.',
    })),
    improvement: improvementObj,
    microGoal: report.recommended_exercise || 'Practice target phrasing to strengthen spontaneous cadence.',
    drillTopic: defaultTopic,
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`API Error ${res.status}: ${errorText || res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    console.warn(`[Toki API] Request to ${url} failed:`, err.message);
    throw err;
  }
}

export const tokiApi = {
  // Health
  async getHealth() {
    return request<{ status: string; gemini_configured: boolean }>('/health');
  },

  // Sessions
  async startSession(userId: number, objective: string): Promise<BackendSessionStart> {
    return request<BackendSessionStart>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, objective }),
    });
  },

  async sendTurn(sessionId: number, transcript: string): Promise<BackendTurnReply> {
    return request<BackendTurnReply>(`/api/sessions/${sessionId}/turn`, {
      method: 'POST',
      body: JSON.stringify({ transcript }),
    });
  },

  async endSession(sessionId: number): Promise<BackendSessionReport> {
    return request<BackendSessionReport>(`/api/sessions/${sessionId}/end`, {
      method: 'POST',
    });
  },

  // Daily Plan
  async getTodayPlan(userId: number): Promise<BackendDailyPlan | null> {
    try {
      return await request<BackendDailyPlan>(`/api/plan/today/${userId}`);
    } catch {
      return null;
    }
  },

  async generatePlan(userId: number, minutes?: number): Promise<BackendDailyPlan> {
    const query = minutes ? `?minutes=${minutes}` : '';
    return request<BackendDailyPlan>(`/api/plan/generate?user_id=${userId}${query ? `&minutes=${minutes}` : ''}`, {
      method: 'POST',
    });
  },

  async completePlan(planId: number): Promise<{ completed: boolean }> {
    return request<{ completed: boolean }>(`/api/plan/${planId}/complete`, {
      method: 'POST',
    });
  },

  // Vocabulary Bank & Mistakes
  async getVocabulary(userId: number): Promise<BackendVocabItem[]> {
    try {
      return await request<BackendVocabItem[]>(`/api/vocabulary/${userId}`);
    } catch {
      return [];
    }
  },

  async addVocabulary(payload: {
    user_id: number;
    word_or_phrase: string;
    meaning: string;
    example: string;
    learner_usage?: string;
  }): Promise<BackendVocabItem> {
    return request<BackendVocabItem>('/api/vocabulary', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMistakes(userId: number): Promise<BackendMistakeItem[]> {
    try {
      return await request<BackendMistakeItem[]>(`/api/mistakes/${userId}`);
    } catch {
      return [];
    }
  },

  // Progress Dashboard
  async getProgress(userId: number): Promise<BackendProgressDashboard | null> {
    try {
      return await request<BackendProgressDashboard>(`/api/progress/${userId}`);
    } catch {
      return null;
    }
  },

  async getWeeklyTrend(userId: number): Promise<any> {
    try {
      return await request<any>(`/api/progress/weekly/${userId}`);
    } catch {
      return null;
    }
  },

  // User Profile & Settings
  async getUserProfile(userId: number): Promise<any> {
    try {
      return await request<any>(`/api/user/${userId}`);
    } catch {
      return null;
    }
  },

  async updateUserProfile(userId: number, data: any): Promise<any> {
    return request<any>(`/api/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getUserSettings(userId: number): Promise<BackendUserSettings | null> {
    try {
      return await request<BackendUserSettings>(`/api/settings/${userId}`);
    } catch {
      return null;
    }
  },

  async updateUserSettings(userId: number, data: Partial<BackendUserSettings>): Promise<BackendUserSettings> {
    return request<BackendUserSettings>(`/api/settings/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Session History & Feedback
  async getSessionHistory(userId: number, limit = 10): Promise<any[]> {
    try {
      return await request<any[]>(`/api/sessions/history/${userId}?limit=${limit}`);
    } catch {
      return [];
    }
  },

  async getSessionFeedback(sessionId: number): Promise<BackendSessionReport | null> {
    try {
      return await request<BackendSessionReport>(`/api/sessions/${sessionId}/feedback`);
    } catch {
      return null;
    }
  },

  // Data Privacy & Export
  async exportUserData(userId: number): Promise<any> {
    return request<any>(`/api/user/export/${userId}`);
  },

  async resetUserData(userId: number): Promise<any> {
    return request<any>(`/api/user/data/${userId}`, {
      method: 'DELETE',
    });
  },

  // Real Scenarios
  async getScenarios(): Promise<any[]> {
    try {
      return await request<any[]>('/api/scenarios');
    } catch {
      return [];
    }
  },

  formatReportToFeedbackData,
};
