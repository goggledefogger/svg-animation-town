import React, { useState, useEffect } from 'react';

interface ActionButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  icon: React.ReactNode;
  text?: string;
  yellow?: boolean;
  disabled?: boolean;
  magical?: boolean;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  ariaLabel,
  title,
  icon,
  text,
  yellow = false,
  disabled = false,
  magical = false
}) => {
  const isMobile = window.innerWidth < 768;
  const [animate, setAnimate] = useState(false);
  const baseClasses = "rounded-md flex items-center justify-center";
  const colorClasses = magical
    ? "magical-button text-white"
    : yellow
      ? "bg-bat-yellow text-black hover:opacity-90"
      : "bg-gray-800 text-white hover:bg-gray-700";
  const sizeClasses = isMobile ? "p-2.5 w-12 h-12" : "px-5 py-2";

  // Add animation class periodically if magical
  useEffect(() => {
    if (!magical) return;

    // Initial animation on mount
    setAnimate(true);
    const initialTimeout = setTimeout(() => setAnimate(false), 2000);

    // Set up interval to animate every 20 seconds
    const interval = setInterval(() => {
      setAnimate(true);
      setTimeout(() => setAnimate(false), 2000);
    }, 20000);

    // Clean up
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [magical]);

  return (
    <button
      className={`${baseClasses} ${colorClasses} ${sizeClasses} ${magical && animate ? 'animate' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
    >
      <span className={magical ? `magical-content ${animate ? 'animate' : ''}` : ""}>{icon}</span>
      {!isMobile && text && <span className={magical ? `magical-content ${animate ? 'animate' : ''} ml-2` : "ml-2"}>{text}</span>}
    </button>
  );
}; 