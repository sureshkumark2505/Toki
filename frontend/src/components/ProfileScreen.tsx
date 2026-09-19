import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { tokiApi, BackendProgressDashboard, BackendUserSettings } from '../services/api';

interface ProfileScreenProps {
  profile: UserProfile;
  userId?: number;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
  onStartSession: (topic?: string) => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  userId = 1,
  onUpdateProfile,
  onStartSession,
}) => {
  const [userName, setUserName] = useState(profile.name || 'Learner');
  const [targetLevel, setTargetLevel] = useState(profile.targetLevel || 'Intermediate (B1/B2)');
  const [nativeLang, setNativeLang] = useState(profile.nativeLanguage || 'English & Tamil');
  const [dailyGoal, setDailyGoal] = useState(profile.dailyGoalMins || 10);
  const [accent, setAccent] = useState('Calm British (Neutral UK)');
  const [feedbackLevel, setFeedbackLevel] = useState<'gentle' | 'balanced' | 'rigorous'>('gentle');
  const [dashboard, setDashboard] = useState<BackendProgressDashboard | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [prog, settings] = await Promise.allSettled([
          tokiApi.getProgress(userId),
          tokiApi.getUserSettings(userId),
        ]);

        if (mounted && prog.status === 'fulfilled' && prog.value) {
          setDashboard(prog.value);
        }

        if (mounted && settings.status === 'fulfilled' && settings.value) {
          const s = settings.value;
          if (s.voice_accent) setAccent(s.voice_accent);
          if (s.feedback_style) {
            const style = s.feedback_style.toLowerCase();
            if (style.includes('rigor')) setFeedbackLevel('rigorous');
            else if (style.includes('balance')) setFeedbackLevel('balanced');
            else setFeedbackLevel('gentle');
          }
        }
      } catch (err) {
        console.warn('Could not load profile settings:', err);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleSaveName = async () => {
    if (!userName.trim()) return;
    setIsSaving(true);
    try {
      await tokiApi.updateUserProfile(userId, { name: userName.trim() });
      onUpdateProfile({ name: userName.trim() });
      setIsEditingName(false);
      showStatus('Name updated successfully');
    } catch (err) {
      console.warn('Could not save name:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateLevel = async (lvl: string) => {
    setTargetLevel(lvl);
    onUpdateProfile({ targetLevel: lvl });
    try {
      await tokiApi.updateUserProfile(userId, { target_level: lvl });
      showStatus('Target level saved');
    } catch (err) {
      console.warn('Could not update target level:', err);
    }
  };

  const handleUpdateNativeLang = async (lang: string) => {
    setNativeLang(lang);
    onUpdateProfile({ nativeLanguage: lang });
    try {
      await tokiApi.updateUserProfile(userId, { native_language: lang });
      await tokiApi.updateUserSettings(userId, { explanation_language: lang });
      showStatus('Language preferences updated');
    } catch (err) {
      console.warn('Could not update native language:', err);
    }
  };

  const handleUpdateDailyGoal = async (mins: number) => {
    setDailyGoal(mins);
    onUpdateProfile({ dailyGoalMins: mins });
    try {
      await tokiApi.updateUserProfile(userId, { daily_minutes: mins });
      await tokiApi.updateUserSettings(userId, { daily_goal_mins: mins });
      showStatus(`Daily target set to ${mins} minutes`);
    } catch (err) {
      console.warn('Could not persist daily goal:', err);
    }
  };

  const handleUpdateAccent = async (newAccent: string) => {
    setAccent(newAccent);
    try {
      await tokiApi.updateUserSettings(userId, { voice_accent: newAccent });
      showStatus('Toki voice accent updated');
    } catch (err) {
      console.warn('Could not persist voice accent:', err);
    }
  };

  const handleUpdateFeedbackLevel = async (lvl: 'gentle' | 'balanced' | 'rigorous') => {
    setFeedbackLevel(lvl);
    try {
      await tokiApi.updateUserSettings(userId, { feedback_style: lvl });
      showStatus(`Feedback tone updated to ${lvl}`);
    } catch (err) {
      console.warn('Could not persist feedback style:', err);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await tokiApi.exportUserData(userId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `toki_learning_data_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showStatus('Learning data exported');
    } catch (err) {
      console.warn('Could not export user data:', err);
    }
  };

  const handleResetData = async () => {
    try {
      await tokiApi.resetUserData(userId);
      onUpdateProfile({ streakDays: 0, totalSessions: 0 });
      setShowResetConfirm(false);
      showStatus('Learning data reset successfully');
      // Refresh
      const prog = await tokiApi.getProgress(userId);
      if (prog) setDashboard(prog);
    } catch (err) {
      console.warn('Could not reset user data:', err);
    }
  };

  const spokenMinutes = dashboard?.speaking_minutes ?? 0;
  const sessionsCount = dashboard?.total_sessions ?? profile.totalSessions ?? 0;
  const grammarScore = dashboard?.grammar_score ?? 72;
  const streakDays = dashboard?.streak_days ?? profile.streakDays ?? 0;
  const masteredCount = dashboard?.mastered_vocabulary_count ?? 0;

  return (
    <div className="flex flex-col w-full px-5 pb-28 pt-2 space-y-5 max-w-md mx-auto">
      {/* Toast Notification */}
      {statusMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-[#181c24] border border-[#8ed5ff]/40 text-[#8ed5ff] text-[13px] px-4 py-2 rounded-full shadow-lg backdrop-blur-md animate-in fade-in">
          {statusMessage}
        </div>
      )}

      {/* Header Profile Summary */}
      <div className="relative w-full rounded-2xl bg-[#181c24] border border-[#3e484f]/25 p-5 shadow-sm overflow-hidden mt-2">
        <div className="absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#38bdf8]/10 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-[#38bdf8] via-[#8ed5ff] to-[#bdc2ff] p-0.5 shadow-md shrink-0">
            <div className="w-full h-full rounded-full bg-[#0f131c] flex items-center justify-center text-[#8ed5ff]">
              <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                account_circle
              </span>
            </div>
            {streakDays > 0 && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#ffc176] text-[#00354a] flex items-center justify-center text-[12px] font-bold shadow">
                🔥
              </div>
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between">
              {isEditingName ? (
                <div className="flex items-center gap-1.5 w-full">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="bg-[#0f131c] border border-[#8ed5ff] rounded-lg px-2.5 py-1 text-[15px] text-[#dfe2ee] font-bold focus:outline-none w-full"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={isSaving}
                    className="px-2.5 py-1 bg-[#8ed5ff] text-[#00354a] rounded-lg text-[12px] font-bold cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-[20px] font-bold text-[#dfe2ee] font-['Plus_Jakarta_Sans'] truncate">
                    {profile.name}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="text-[#bdc8d1] hover:text-[#8ed5ff] text-[16px] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] font-semibold text-[#8ed5ff] bg-[#8ed5ff]/10 border border-[#8ed5ff]/20 px-2 py-0.5 rounded-full">
                {targetLevel}
              </span>
            </div>

            <p className="text-[12px] text-[#bdc8d1] mt-1">
              {streakDays} day streak • {sessionsCount} sessions completed
            </p>
          </div>
        </div>
      </div>

      {/* Speaking Confidence Milestones */}
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider font-semibold">
            Speaking Milestones
          </span>
          <span className="text-[12px] text-[#8ed5ff]">Live Metrics</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-[#1c2028] border border-[#3e484f]/25 rounded-xl p-3 text-center flex flex-col items-center">
            <span className="text-[11px] text-[#bdc8d1]">Spoken Time</span>
            <span className="text-[18px] font-bold text-[#dfe2ee] mt-0.5">{spokenMinutes} min</span>
            <span className="text-[10px] text-[#8ed5ff] mt-0.5">{sessionsCount} sessions</span>
          </div>

          <div className="bg-[#1c2028] border border-[#3e484f]/25 rounded-xl p-3 text-center flex flex-col items-center">
            <span className="text-[11px] text-[#bdc8d1]">Mastered Words</span>
            <span className="text-[18px] font-bold text-[#dfe2ee] mt-0.5">{masteredCount}</span>
            <span className="text-[10px] text-[#ffc176] mt-0.5">In bank</span>
          </div>

          <div className="bg-[#1c2028] border border-[#3e484f]/25 rounded-xl p-3 text-center flex flex-col items-center">
            <span className="text-[11px] text-[#bdc8d1]">Grammar Ease</span>
            <span className="text-[18px] font-bold text-[#bdc2ff] mt-0.5">{grammarScore}%</span>
            <span className="text-[10px] text-[#bdc2ff] mt-0.5">Assessed</span>
          </div>
        </div>
      </div>

      {/* Preferences & Coaching Experience */}
      <div className="flex flex-col space-y-2">
        <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider font-semibold px-1">
          Learner Preferences &amp; Voice
        </span>

        <div className="bg-[#181c24] border border-[#3e484f]/25 rounded-2xl p-4 space-y-4 shadow-sm">
          {/* Target Level */}
          <div>
            <label className="text-[13px] text-[#dfe2ee] font-medium block mb-1.5">
              Target Speaking Level
            </label>
            <select
              value={targetLevel}
              onChange={(e) => handleUpdateLevel(e.target.value)}
              className="w-full bg-[#1c2028] border border-[#3e484f]/30 rounded-xl px-3 py-2 text-[13px] text-[#dfe2ee] focus:outline-none focus:border-[#8ed5ff]"
            >
              <option value="Beginner (A1/A2)">Beginner (A1/A2)</option>
              <option value="Intermediate (B1/B2)">Intermediate (B1/B2)</option>
              <option value="Upper Intermediate (B2/C1)">Upper Intermediate (B2/C1)</option>
              <option value="Advanced Fluency (C1/C2)">Advanced Fluency (C1/C2)</option>
            </select>
          </div>

          {/* Native Language */}
          <div>
            <label className="text-[13px] text-[#dfe2ee] font-medium block mb-1.5">
              Native Language / Explanation Language
            </label>
            <input
              type="text"
              value={nativeLang}
              onChange={(e) => setNativeLang(e.target.value)}
              onBlur={() => handleUpdateNativeLang(nativeLang)}
              placeholder="e.g., English & Tamil, Spanish, Hindi"
              className="w-full bg-[#1c2028] border border-[#3e484f]/30 rounded-xl px-3 py-2 text-[13px] text-[#dfe2ee] focus:outline-none focus:border-[#8ed5ff]"
            />
          </div>

          {/* Daily Goal */}
          <div>
            <label className="text-[13px] text-[#dfe2ee] font-medium block mb-1.5">
              Daily Practice Target
            </label>
            <div className="flex gap-2">
              {[5, 10, 15, 20].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => handleUpdateDailyGoal(mins)}
                  className={`flex-1 py-2 rounded-xl text-[12px] font-medium transition-all cursor-pointer ${
                    dailyGoal === mins
                      ? 'bg-[#8ed5ff] text-[#00354a] font-bold shadow-sm'
                      : 'bg-[#1c2028] text-[#bdc8d1] hover:bg-[#262a33]'
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>
          </div>

          {/* Voice Accent */}
          <div>
            <label className="text-[13px] text-[#dfe2ee] font-medium block mb-1.5">
              Toki&apos;s Voice Accent
            </label>
            <select
              value={accent}
              onChange={(e) => handleUpdateAccent(e.target.value)}
              className="w-full bg-[#1c2028] border border-[#3e484f]/30 rounded-xl px-3 py-2 text-[13px] text-[#dfe2ee] focus:outline-none focus:border-[#8ed5ff]"
            >
              <option value="Calm British (Neutral UK)">Calm British (Neutral UK)</option>
              <option value="Friendly American (Standard US)">Friendly American (Standard US)</option>
              <option value="Warm Australian">Warm Australian</option>
            </select>
          </div>

          {/* Feedback Tone */}
          <div>
            <label className="text-[13px] text-[#dfe2ee] font-medium block mb-1.5">
              Feedback Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['gentle', 'balanced', 'rigorous'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => handleUpdateFeedbackLevel(lvl)}
                  className={`py-2 px-1 rounded-xl text-[11px] capitalize font-medium transition-all cursor-pointer ${
                    feedbackLevel === lvl
                      ? 'bg-[#8ed5ff]/20 text-[#8ed5ff] border border-[#8ed5ff]/40 font-semibold'
                      : 'bg-[#1c2028] text-[#bdc8d1] border border-[#3e484f]/20'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#87929a] mt-1.5">
              {feedbackLevel === 'gentle'
                ? 'Gentle: Encouraging and constructive highlights with single focus points.'
                : feedbackLevel === 'balanced'
                ? 'Balanced: Objective corrections with nuance guidance.'
                : 'Rigorous: Detailed structural analysis across grammar, vocabulary, and flow.'}
            </p>
          </div>
        </div>
      </div>

      {/* Data Privacy & Management */}
      <div className="flex flex-col space-y-2">
        <span className="text-[12px] text-[#bdc8d1] uppercase tracking-wider font-semibold px-1">
          Data &amp; Privacy Control
        </span>

        <div className="bg-[#181c24] border border-[#3e484f]/25 rounded-2xl p-4 flex flex-col space-y-2.5">
          <button
            type="button"
            onClick={handleExportData}
            className="w-full py-2.5 px-4 rounded-xl bg-[#1c2028] hover:bg-[#262a33] text-[#dfe2ee] border border-[#3e484f]/30 text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[18px] text-[#8ed5ff]">download</span>
            <span>Export My Learning Data (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#93000a]/20 hover:bg-[#93000a]/35 text-[#ffb4ab] border border-[#ffb4ab]/25 text-[13px] font-medium flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
            <span>Reset Learning History</span>
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="bg-[#181c24] border border-[#3e484f] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-[#ffb4ab]">
              <span className="material-symbols-outlined text-[24px]">warning</span>
              <h3 className="text-[16px] font-bold">Reset Learning History?</h3>
            </div>
            <p className="text-[13px] text-[#bdc8d1] leading-relaxed">
              This will clear your previous practice sessions, turn history, and streak counter. Your profile settings will be preserved.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-[#1c2028] text-[#dfe2ee] text-[13px] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetData}
                className="flex-1 py-2 rounded-xl bg-[#93000a] text-white text-[13px] font-bold cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Start quick session button */}
      <button
        type="button"
        onClick={() => onStartSession('Reflecting on personal goals and communication habits')}
        className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#38bdf8] to-[#8ed5ff] text-[#00354a] font-['Plus_Jakarta_Sans'] font-bold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#38bdf8]/20 active:scale-[0.98] transition-all cursor-pointer"
      >
        <span className="material-symbols-outlined text-[20px]">record_voice_over</span>
        <span>Practice Now</span>
      </button>
    </div>
  );
};
