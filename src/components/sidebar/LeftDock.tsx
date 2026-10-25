import React from 'react';

interface LeftDockProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const LeftDock: React.FC<LeftDockProps> = ({
  isOpen,
  onToggle,
  children,
}) => {
  return (
    <div
      className={`hidden md:flex absolute top-11 bottom-0 left-0 z-30 flex-col transition-transform duration-300 ease-in-out pointer-events-none ${
        isOpen ? 'w-80 md:w-96 translate-x-0' : 'w-80 md:w-96 -translate-x-full'
      }`}
    >
      <div className="relative flex flex-col h-full bg-[#F7F4ED] border-r border-[#D6D0C2] shadow-2xl overflow-hidden pointer-events-auto">
        {children}
      </div>

      {/* Tray Edge Pull Tab */}
      <button
        onClick={onToggle}
        className="absolute top-0 bottom-0 left-full pointer-events-auto z-40 flex items-center justify-center w-5 bg-[#FAF8F3] hover:bg-[#EFECE4] border-r border-[#D6D0C2] hover:border-[#8A847C] shadow-[2px_0_6px_rgba(0,0,0,0.06)] transition-colors cursor-pointer group"
        title={isOpen ? 'Collapse directory tray' : 'Open directory tray'}
        aria-label={isOpen ? 'Collapse directory tray' : 'Open directory tray'}
      >
        <div className="flex items-center justify-center w-4 h-8 rounded-md group-hover:bg-[#E5E0D5] transition-colors">
          <svg
            className="w-2.5 h-3 text-[#5A554E] group-hover:text-[#1C1B18] transition-colors"
            viewBox="0 0 8 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {isOpen ? (
              <polyline points="5.5 1.5 2 5 5.5 8.5" />
            ) : (
              <polyline points="2.5 1.5 6 5 2.5 8.5" />
            )}
          </svg>
        </div>
      </button>
    </div>
  );
};
