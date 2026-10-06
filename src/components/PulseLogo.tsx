export function PulseLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Pulse">
      <rect width="48" height="48" rx="14" fill="var(--md-primary)" />
      <path
        d="M8 26h8l4-10 7 20 5-14 3 4h5"
        fill="none"
        stroke="var(--md-on-primary)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
