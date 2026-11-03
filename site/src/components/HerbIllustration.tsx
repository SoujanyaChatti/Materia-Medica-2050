// Line-art placeholder for a herbal plate (used until a public-domain manuscript image with a
// confirmed licence and shelfmark is available). Stroke follows the theme.
export function HerbIllustration({ alt, className, style }: { alt: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 240 320" role="img" aria-label={alt} className={className} style={{ color: 'var(--ochre)', ...style }}>
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 300 C118 240 122 180 120 60" />
        <path d="M120 300 C108 304 96 310 84 312 M120 300 C130 306 146 309 160 310 M120 300 C116 308 112 314 106 318 M120 300 C126 309 130 314 136 318" />
        <path d="M120 250 C101.6 234 74 240.4 74 252 C87.8 259.6 106.2 254.8 120 250Z" /><path d="M120 250 L80.9 250" />
        <path d="M120 250 C138.4 234 166 240.4 166 252 C152.2 259.6 133.8 254.8 120 250Z" /><path d="M120 250 L159.1 250" />
        <path d="M120 205 C104.4 191 81 196.6 81 207 C92.7 213.4 108.3 209.2 120 205Z" /><path d="M120 205 L86.85 205" />
        <path d="M120 205 C135.6 191 159 196.6 159 207 C147.3 213.4 131.7 209.2 120 205Z" /><path d="M120 205 L153.15 205" />
        <path d="M120 160 C107.2 148 88 152.8 88 162 C97.6 167.2 110.4 163.6 120 160Z" /><path d="M120 160 L92.8 160" />
        <path d="M120 160 C132.8 148 152 152.8 152 162 C142.4 167.2 129.6 163.6 120 160Z" /><path d="M120 160 L147.2 160" />
        <path d="M120 118 C110 108 95 112 95 120 C102.5 124 112.5 121 120 118Z" /><path d="M120 118 L98.75 118" />
        <path d="M120 118 C130 108 145 112 145 120 C137.5 124 127.5 121 120 118Z" /><path d="M120 118 L141.25 118" />
        <ellipse cx="120" cy="96" rx="10" ry="7" /><path d="M112 94 l-6 -4 M128 94 l6 -4" />
        <ellipse cx="120" cy="78" rx="8" ry="6" /><path d="M114 76 l-6 -4 M126 76 l6 -4" />
        <ellipse cx="120" cy="62" rx="6" ry="5" /><path d="M116 60 l-6 -4 M124 60 l6 -4" />
        <path d="M120 60 C117 50 119 42 120 36 C121 42 123 50 120 60" />
      </g>
    </svg>
  );
}
