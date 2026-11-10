import "./BrandLogo.css";

interface BrandLogoProps {
  variant?: "full" | "mark";
  tone?: "light" | "dark";
  size?: number;
  className?: string;
}

export function BrandLogo({
  variant = "full",
  tone = "light",
  size = 44,
  className = "",
}: BrandLogoProps) {
  return (
    <span
      className={`brand-logo brand-logo--${tone} ${className}`}
      role="img"
      aria-label="INNVYRA PMS"
    >
      <img
        src={
          tone === "dark"
            ? "/brand/innvyra-mark-inverse.svg"
            : "/brand/innvyra-mark.svg"
        }
        width={size * 1.4}
        height={size}
        alt=""
        aria-hidden="true"
      />
      {variant === "full" && (
        <span
          className="brand-logo__wordmark"
          style={{ fontSize: size * 0.6 }}
          aria-hidden="true"
        >
          <span className="brand-logo__name">INNVYRA</span>
          <span className="brand-logo__product">PMS</span>
        </span>
      )}
    </span>
  );
}
