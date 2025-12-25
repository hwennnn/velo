/**
 * MobileContainer Component
 * 
 * Wraps the entire app in a centered mobile container.
 * On desktop, it shows a phone-sized container (max-w-md).
 * On mobile, it uses full width with safe area insets.
 */
import type { ReactNode } from 'react';

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
}

export default function MobileContainer({ children, className = '' }: MobileContainerProps) {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-0 md:p-4">
      {/* Phone Container */}
      <div 
        className={`
          w-full 
          max-w-md 
          h-screen 
          md:h-[calc(100vh-2rem)] 
          md:max-h-[900px]
          bg-white 
          md:rounded-3xl 
          md:shadow-2xl 
          overflow-hidden 
          relative
          flex
          flex-col
          ${className}
        `}
      >
        {/* Safe area aware content */}
        <div className="flex-1 w-full safe-top safe-bottom flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}

