import React, { useState, useEffect } from 'react';
import { PRACTICE_MODES } from '../data';
import { PracticeMode } from '../types';
import { tokiApi } from '../services/api';

interface PracticeModesScreenProps {
  onSelectMode: (mode: PracticeMode) => void;
}

export const PracticeModesScreen: React.FC<PracticeModesScreenProps> = ({ onSelectMode }) => {
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showScenariosModal, setShowScenariosModal] = useState(false);

  useEffect(() => {
    async function loadScenarios() {
      try {
        const scList = await tokiApi.getScenarios();
        if (scList && scList.length > 0) {
          setScenarios(scList);
        }
      } catch (err) {
        console.warn('Could not load scenarios list:', err);
      }
    }
    loadScenarios();
  }, []);

  const handleModeClick = (mode: PracticeMode) => {
    if (mode.id === 'scenarios') {
      setShowScenariosModal(true);
    } else {
      onSelectMode(mode);
    }
  };

  const handleStartScenario = (scenario: any) => {
    setShowScenariosModal(false);
    onSelectMode({
      id: `scenario-${scenario.id}`,
      title: scenario.title,
      duration: '10 min',
      focus: `${scenario.category} • ${scenario.level}`,
      description: scenario.description,
      icon: 'storefront',
      promptTopic: `Roleplay: ${scenario.title} (${scenario.objective})`,
    });
  };

  const categories = ['All', 'Workplace', 'Job Interview', 'Travel & Hospitality', 'Daily Life'];
  const filteredScenarios =
    !selectedCategory || selectedCategory === 'All'
      ? scenarios
      : scenarios.filter((s) => s.category.toLowerCase().includes(selectedCategory.toLowerCase()));

  return (
    <div className="flex flex-col w-full px-5 pb-28 pt-2 max-w-md mx-auto">
      {/* Atmospheric Subtle Glow Anchor */}
      <div className="relative w-full flex flex-col pt-3 pb-5 overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#38bdf8]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Section */}
        <div className="relative z-10 flex flex-col">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-[#8ed5ff] animate-ping" />
            <span className="text-[11px] uppercase tracking-widest text-[#8ed5ff] font-semibold">
              Voice Practice
            </span>
          </div>
          <h1 className="text-[28px] font-bold text-[#dfe2ee] tracking-tight font-['Plus_Jakarta_Sans'] leading-tight">
            Practice Modes
          </h1>
          <p className="text-[14px] text-[#bdc8d1] mt-1 leading-relaxed">
            Choose how you want to speak with Toki today.
          </p>
        </div>
      </div>

      {/* Curated Modes List */}
      <div className="flex flex-col gap-3.5 w-full">
        {PRACTICE_MODES.map((mode) => {
          const isFeatured = mode.id === 'daily';
          return (
            <div
              key={mode.id}
              id={`practice-mode-${mode.id}`}
              onClick={() => handleModeClick(mode)}
              className="group relative flex flex-col p-4 rounded-2xl bg-[#181c24] border border-[#3e484f]/25 transition-all duration-200 active:scale-[0.99] hover:bg-[#1c2028] hover:border-[#8ed5ff]/40 cursor-pointer shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#1c2028] border border-[#3e484f]/20 flex items-center justify-center text-[#8ed5ff] shrink-0 transition-transform group-hover:scale-105 shadow-inner">
                    <span className="material-symbols-outlined text-[24px]">
                      {mode.icon}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold text-[#dfe2ee] truncate font-['Plus_Jakarta_Sans']">
                        {mode.title}
                      </span>
                      {mode.badge && (
                        <span className="px-2 py-0.5 rounded-full bg-[#8ed5ff]/15 text-[#8ed5ff] text-[11px] font-medium shrink-0 border border-[#8ed5ff]/25">
                          {mode.badge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[#bdc8d1] mt-0.5 text-[12px]">
                      <span className="material-symbols-outlined text-[14px] text-[#8ed5ff]">
                        schedule
                      </span>
                      <span className="font-medium text-[#dfe2ee]">{mode.duration}</span>
                      <span className="text-[#87929a] text-[10px]">•</span>
                      <span className="text-[#bdc8d1] truncate">{mode.focus}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label={`Start ${mode.title}`}
                  className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 shadow-sm active:scale-95 transition-all ${
                    isFeatured
                      ? 'bg-[#8ed5ff] text-[#00354a]'
                      : 'bg-[#262a33] text-[#dfe2ee] group-hover:bg-[#8ed5ff] group-hover:text-[#00354a]'
                  }`}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    play_arrow
                  </span>
                </button>
              </div>

              <div className="mt-3 pt-3 border-t border-[#3e484f]/20 flex items-center justify-between text-[#bdc8d1]">
                <p className="text-[12px] text-[#bdc8d1] line-clamp-1">{mode.description}</p>
                <span className="material-symbols-outlined text-[18px] text-[#bdc8d1] ml-2 shrink-0 group-hover:translate-x-0.5 transition-transform">
                  chevron_right
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-life Scenarios Modal Drawer */}
      {showScenariosModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex flex-col justify-end p-0">
          <div className="bg-[#181c24] border-t border-[#3e484f]/40 rounded-t-3xl p-5 max-w-md w-full mx-auto max-h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#3e484f]/30 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#bdc2ff] text-[22px]">
                  storefront
                </span>
                <h3 className="text-[17px] font-bold text-[#dfe2ee]">Real-life Scenarios</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowScenariosModal(false)}
                className="w-8 h-8 rounded-full bg-[#262a33] flex items-center justify-center text-[#bdc8d1] hover:text-[#dfe2ee]"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Category Filter Chips */}
            <div className="flex gap-2 overflow-x-auto py-3 shrink-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all cursor-pointer ${
                    (selectedCategory === cat || (!selectedCategory && cat === 'All'))
                      ? 'bg-[#8ed5ff] text-[#00354a] font-bold shadow-sm'
                      : 'bg-[#1c2028] text-[#bdc8d1] border border-[#3e484f]/30'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Scenarios List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 pt-1 pb-4">
              {filteredScenarios.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => handleStartScenario(sc)}
                  className="p-3.5 rounded-xl bg-[#1c2028] border border-[#3e484f]/25 hover:border-[#8ed5ff]/40 hover:bg-[#262a33] active:scale-[0.99] transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[#dfe2ee]">{sc.title}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#8ed5ff]/10 text-[#8ed5ff] border border-[#8ed5ff]/20">
                      {sc.level}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#bdc8d1] line-clamp-2 leading-relaxed">
                    {sc.description}
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-[#87929a]">
                    <span>Role: <strong className="text-[#dfe2ee]">{sc.role}</strong></span>
                    <span>•</span>
                    <span className="text-[#ffc176]">{sc.difficulty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reassuring Presence & Adaptive Note */}
      <div className="mt-6 flex items-center justify-center gap-2.5 px-4 py-3 rounded-full bg-[#0a0e16]/80 border border-[#3e484f]/25 text-[#bdc8d1] text-center shadow-inner">
        <span className="material-symbols-outlined text-[18px] text-[#8ed5ff]">
          graphic_eq
        </span>
        <span className="text-[13px] font-medium">
          Every mode adapts to your spoken pace in real-time.
        </span>
      </div>
    </div>
  );
};
