import { useId } from "react";

/** Decorative product illustration; deliberately contains no live business figures. */
export function LoginIllustration() {
  const shadowId = useId();

  return (
    <div className="login-illustration" aria-hidden="true">
      <svg viewBox="0 0 640 350" fill="none" focusable="false">
        <defs>
          <filter id={shadowId} x="-30%" y="-30%" width="180%" height="190%">
            <feDropShadow
              dx="0"
              dy="14"
              stdDeviation="14"
              floodColor="#041b13"
              floodOpacity="0.28"
            />
          </filter>
        </defs>
        <ellipse
          cx="326"
          cy="318"
          rx="260"
          ry="20"
          fill="#061e16"
          opacity="0.25"
        />
        <path
          d="M30 292c138-63 339-36 572-117"
          stroke="#c6ad77"
          strokeOpacity="0.22"
        />
        <g transform="rotate(-5 275 180)" filter={`url(#${shadowId})`}>
          <rect x="48" y="42" width="446" height="262" rx="18" fill="#f5f1e7" />
          <path
            d="M66 42h410a18 18 0 0 1 18 18v26H48V60a18 18 0 0 1 18-18Z"
            fill="#315e4c"
          />
          {[73, 89, 105].map((x) => (
            <circle key={x} cx={x} cy="64" r="4" fill="#d6bf8d" />
          ))}
          <rect
            x="371"
            y="60"
            width="92"
            height="6"
            rx="3"
            fill="#b0c5b7"
            opacity="0.4"
          />
          <rect x="112" y="104" width="354" height="20" rx="5" fill="#e5e4d8" />
          {[168, 224, 280, 336, 392, 448].map((x) => (
            <path key={x} d={`M${x} 132v146`} stroke="#dcded2" />
          ))}
          {[164, 209, 254].map((y) => (
            <path key={y} d={`M112 ${y}h354`} stroke="#dcded2" />
          ))}
          {[145, 190, 235, 280].map((y) => (
            <g
              key={y}
              transform={`translate(73 ${y - 12})`}
              stroke="#4d7561"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M0 12V2m0 7h21v7m-21-4h21M4 8V4h12a5 5 0 0 1 5 5M4 6h5" />
            </g>
          ))}
          <rect x="137" y="136" width="100" height="23" rx="6" fill="#8eaf9b" />
          <rect x="252" y="181" width="155" height="23" rx="6" fill="#d2b985" />
          <rect x="137" y="226" width="156" height="23" rx="6" fill="#8eaf9b" />
          <rect x="308" y="271" width="99" height="23" rx="6" fill="#8eaf9b" />
          <path
            d="M150 147h52m63 45h91m-206 45h93m80 45h51"
            stroke="#f8f5ed"
            strokeOpacity="0.55"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <g filter={`url(#${shadowId})`}>
          <rect
            x="384"
            y="83"
            width="204"
            height="111"
            rx="17"
            fill="#fffcf5"
            stroke="#ece4d4"
          />
          <rect x="403" y="102" width="35" height="35" rx="10" fill="#f0e7d2" />
          <g
            transform="translate(411 110)"
            stroke="#a6854b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="0" y="2" width="19" height="17" rx="3" />
            <path d="M5 0v5m9-5v5M0 8h19m-14 5h3m3 0h3" />
          </g>
          <rect
            x="450"
            y="109"
            width="108"
            height="7"
            rx="3.5"
            fill="#b0b8a8"
          />
          <rect x="450" y="125" width="74" height="5" rx="2.5" fill="#dedfd3" />
          <rect x="403" y="157" width="100" height="6" rx="3" fill="#dedfd3" />
          <circle cx="555" cy="160" r="15" fill="#c6ad77" />
          <path
            d="m548 160 5 5 9-10"
            stroke="#fffdf7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        <g filter={`url(#${shadowId})`}>
          <rect
            x="441"
            y="221"
            width="145"
            height="103"
            rx="16"
            fill="#fffcf5"
            stroke="#ece4d4"
          />
          <path
            d="M461 304h105"
            stroke="#dfdfd1"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <rect x="469" y="277" width="18" height="26" rx="4" fill="#a4bda8" />
          <rect x="502" y="260" width="18" height="43" rx="4" fill="#739b80" />
          <rect x="535" y="239" width="18" height="64" rx="4" fill="#315e4c" />
        </g>
      </svg>
    </div>
  );
}
