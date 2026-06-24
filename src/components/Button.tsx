interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  isLoading?: boolean;
  variant?: "primary" | "secondary";
}

export function Button({
  children,
  className = "",
  isLoading = false,
  variant = "primary",
  ...props
}: ButtonProps) {
  const baseClass =
    variant === "primary" ? "cta-primary earn-cta" : "cta-secondary";

  return (
    <button className={`${baseClass} ${className}`.trim()} {...props}>
      {isLoading ? <span style={{ opacity: 0.7 }}>Loading…</span> : children}
    </button>
  );
}
