import React from 'react';
import { TOKI_BRAND_LOGO } from '../data';

interface TopHeaderProps {
  subTitle?: string;
  onProfileClick?: () => void;
  onMicStatusClick?: () => void;
  activeMic?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  subTitle = 'Home',
  onProfileClick,
  onMicStatusClick,
  activeMic = false,
}) => {
  return (
    <header id="main-header" className="fixed top-0 left-0 right-0 w-full z-40 pt-safe bg-[#0f131c]/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.25)] border-b border-[#3e484f]/20">
      <div className="h-16 max-w-md mx-auto px-5 flex items-center justify-between">
        {/* Brand mark & title */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-gradient-to-tr from-[#38bdf8] via-[#8ed5ff] to-[#bdc2ff] p-0.5 shadow-sm">
            <img
              src={TOKI_BRAND_LOGO}
              alt="Toki Brand Mark"
              className="w-full h-full object-contain rounded-full bg-[#0f131c]"
              onError={(e) => {
                // Graceful fallback if image blocked
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-['Plus_Jakarta_Sans'] font-semibold text-[18px] text-[#dfe2ee] tracking-tight leading-none">
              Toki
            </span>
            <span className="font-['Plus_Jakarta_Sans'] text-[11px] text-[#bdc8d1] font-medium tracking-normal mt-0.5">
              {subTitle}
            </span>
          </div>
        </div>

        {/* Right side indicators & profile */}
        <div className="flex items-center gap-2.5">
          <button
            id="audio-indicator-btn"
            type="button"
            onClick={onMicStatusClick}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#181c24] border border-[#3e484f]/30 hover:border-[#8ed5ff]/40 transition-colors"
            title="Audio Engine Ready"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${activeMic ? 'bg-[#38bdf8] animate-ping' : 'bg-[#8ed5ff] animate-pulse'}`} />
            <span className="material-symbols-outlined text-[16px] text-[#8ed5ff]">
              graphic_eq
            </span>
          </button>

          <button
            id="user-profile-header-btn"
            type="button"
            onClick={onProfileClick}
            className="w-8 h-8 rounded-full bg-[#8ed5ff] hover:bg-[#c4e7ff] flex items-center justify-center text-[#00354a] transition-transform active:scale-95 shadow-sm"
            title="User Profile"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              person
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
