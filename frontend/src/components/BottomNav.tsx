import React from 'react';
import { NavTab } from '../types';

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const tabs: Array<{ id: NavTab; label: string; icon: string }> = [
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'practice', label: 'Practice', icon: 'mic' },
    { id: 'progress', label: 'Progress', icon: 'insights' },
    { id: 'profile', label: 'Profile', icon: 'account_circle' },
  ];

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 w-full z-40 pb-safe bg-[#0f131c]/90 backdrop-blur-xl border-t border-[#3e484f]/25 shadow-[0_-4px_24px_rgba(0,0,0,0.3)]"
    >
      <div className="max-w-md mx-auto flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-btn-${tab.id}`}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 h-12 transition-colors active:scale-95 ${
                isActive
                  ? 'text-[#8ed5ff] font-semibold'
                  : 'text-[#bdc8d1] hover:text-[#dfe2ee]'
              }`}
            >
              <div
                className={`flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-[#8ed5ff]/15 text-[#8ed5ff]' : 'bg-transparent text-inherit'
                }`}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {tab.icon}
                </span>
              </div>
              <span className="text-[11px] font-medium tracking-normal leading-none font-['Plus_Jakarta_Sans']">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
