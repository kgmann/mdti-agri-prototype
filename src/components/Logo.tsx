// Logo mark: a leaf over a location pin (agriculture + geodata).
export default function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2C9.9 2 5 6.8 5 12.8 5 20.7 16 30 16 30s11-9.3 11-17.2C27 6.8 22.1 2 16 2z" fill="#f2c14e" />
      <path d="M11 17.5c0-5 3.6-8.4 10-9-0.4 6.3-3.9 10-9 10" fill="#1f7a3d" />
      <path d="M11.5 18c2-2.6 4.2-4.6 7-6.2" stroke="#f7f7f4" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
