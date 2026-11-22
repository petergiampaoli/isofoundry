interface IconProps {
  name: 'diamond' | 'lock' | 'unlock' | 'play' | 'pause' | 'arrow' | 'sparkle' | 'export' | 'check' | 'refresh' | 'plus' | 'download' | 'close' | 'chevron';
  size?: number;
  className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };
  switch (name) {
    case 'diamond':
      return (
        <svg {...common}>
          <path d="M12 2.5 21.5 12 12 21.5 2.5 12 12 2.5Z" />
          <path d="m7 12 5-4.5 5 4.5-5 4.5L7 12Z" fill="currentColor" stroke="none" opacity="0.35" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
        </svg>
      );
    case 'unlock':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="11" rx="2" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 6.7-1.5" />
        </svg>
      );
    case 'play':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M8 5.5v13l10-6.5-10-6.5Z" />
        </svg>
      );
    case 'pause':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <rect x="7" y="5" width="3.5" height="14" rx="1" />
          <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
        </svg>
      );
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );
    case 'sparkle':
      return (
        <svg {...common}>
          <path d="M12 3c.45 4.3 2.7 6.55 7 7-4.3.45-6.55 2.7-7 7-.45-4.3-2.7-6.55-7-7 4.3-.45 6.55-2.7 7-7Z" />
          <path d="M19 16.5c.2 1.6 1 2.4 2.5 2.5-1.5.15-2.3.95-2.5 2.5-.2-1.55-1-2.35-2.5-2.5 1.5-.1 2.3-.9 2.5-2.5Z" />
        </svg>
      );
    case 'export':
      return (
        <svg {...common}>
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 4v11" />
          <path d="m7.5 11 4.5 4.5 4.5-4.5" />
          <path d="M5 20h14" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 1 0-2.3 6.4" />
          <path d="M20 4v7h-7" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 6 6 6-6 6" />
        </svg>
      );
  }
}
