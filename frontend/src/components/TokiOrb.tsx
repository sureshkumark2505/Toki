import React from 'react';
import { VoiceState } from '../types';

interface TokiOrbProps {
  state?: VoiceState;
  size?: 'sm' | 'md' | 'lg' | 'hero';
  onClick?: () => void;
  interactive?: boolean;
  centerIcon?: string;
  showRings?: boolean;
}

export const TokiOrb: React.FC<TokiOrbProps> = ({
  state = 'speaking',
  size = 'md',
  onClick,
  interactive = true,
  centerIcon,
  showRings = true,
}) => {
  // Dimensions based on size
  const sizeMap = {
    sm: { box: 'w-16 h-16', outer: 'w-16 h-16', mid: 'inset-1', core: 'w-11 h-11', center: 'w-6 h-6', dot: 'w-3 h-3', glow: 'w-24 h-24' },
    md: { box: 'w-24 h-24', outer: 'w-24 h-24', mid: 'inset-2', core: 'w-16 h-16', center: 'w-8 h-8', dot: 'w-4 h-4', glow: 'w-36 h-36' },
    lg: { box: 'w-36 h-36', outer: 'w-36 h-36', mid: 'inset-3', core: 'w-24 h-24', center: 'w-12 h-12', dot: 'w-6 h-6', glow: 'w-52 h-52' },
    hero: { box: 'w-52 h-52', outer: 'w-52 h-52', mid: 'inset-4', core: 'w-36 h-36', center: 'w-16 h-16', dot: 'w-7 h-7', glow: 'w-72 h-72' },
  };

  const dim = sizeMap[size];

  // Dynamics based on voice state
  let glowClasses = 'from-[#2f3aa3]/20 via-[#38bdf8]/25 to-[#8ed5ff]/10';
  let coreScale = 'scale-100';
  let outerRingScale = 'scale-100';
  let pulseAnimation = 'animate-pulse';

  if (state === 'listening') {
    glowClasses = 'from-[#bdc2ff]/30 via-[#8ed5ff]/20 to-[#38bdf8]/20';
    coreScale = 'scale-110';
    outerRingScale = 'scale-105';
    pulseAnimation = 'animate-ping opacity-60';
  } else if (state === 'thinking') {
    glowClasses = 'from-[#f1a02b]/30 via-[#2f3aa3]/20 to-[#8ed5ff]/20';
    coreScale = 'scale-95 rotate-45';
    outerRingScale = 'scale-95';
    pulseAnimation = 'animate-spin opacity-50 duration-3000';
  } else if (state === 'speaking') {
    glowClasses = 'from-[#2f3aa3]/20 via-[#38bdf8]/25 to-[#8ed5ff]/10';
    coreScale = 'scale-100';
    outerRingScale = 'scale-100';
    pulseAnimation = 'animate-pulse';
  } else if (state === 'paused') {
    glowClasses = 'from-[#1c2028]/40 via-[#181c24]/30 to-transparent';
    coreScale = 'scale-90';
    outerRingScale = 'scale-90';
    pulseAnimation = 'opacity-30';
  }

  return (
    <div
      id="toki-orb-container"
      className={`relative flex items-center justify-center ${dim.box} ${interactive ? 'cursor-pointer select-none active:scale-95' : ''} transition-transform duration-300`}
      onClick={onClick}
    >
      {/* Ambient Luminous Backdrop Glow */}
      <div
        className={`absolute ${dim.glow} rounded-full bg-gradient-to-tr ${glowClasses} blur-3xl pointer-events-none transition-all duration-700`}
      />

      {showRings && (
        <>
          {/* Outermost soft halo ring */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-b from-[#8ed5ff]/20 via-[#bdc2ff]/10 to-transparent blur-md ${pulseAnimation} transition-all duration-500 ${outerRingScale}`}
          />
        </>
      )}

      {/* Intermediate luminous disc */}
      <div
        className={`absolute ${dim.mid} rounded-full bg-gradient-to-tr from-[#2f3aa3] via-[#262a33]/40 to-[#8ed5ff]/30 backdrop-blur-sm flex items-center justify-center transition-all duration-500 shadow-xl`}
      >
        {/* Deep resonant inner glow */}
        <div
          className={`${dim.core} rounded-full bg-gradient-to-br from-[#38bdf8] via-[#8ed5ff] to-[#bdc2ff]/70 opacity-90 flex items-center justify-center shadow-inner transition-transform duration-500 ${coreScale}`}
        >
          {/* Focal center aperture (matching brand icon silhouette) */}
          <div
            className={`${dim.center} rounded-full bg-[#0f131c] shadow-2xl flex items-center justify-center transition-all duration-300`}
          >
            {centerIcon ? (
              <span className="material-symbols-outlined text-[#8ed5ff] text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {centerIcon}
              </span>
            ) : (
              <div className={`${dim.dot} rounded-full bg-[#c4e7ff] opacity-95`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
