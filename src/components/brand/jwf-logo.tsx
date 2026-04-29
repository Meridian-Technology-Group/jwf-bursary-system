/**
 * JwfLogo — wordmark for the John Whitgift Foundation.
 *
 * Source PNG is the official black wordmark from johnwhitgiftfoundation.org.
 * On dark backgrounds (e.g. admin sidebar, portal sidebar header strip), pass
 * `tone="light"` to invert it to white via CSS — no second asset to maintain.
 *
 * Sizes are relative to the natural aspect ratio (144 × 150 for the full mark,
 * 105 × 80 for the compact mark). Pick the variant via `compact`.
 */

import Image from "next/image";
import { cn } from "@/lib/utils";

interface JwfLogoProps {
  /** Visual tone — `dark` keeps the natural black ink, `light` inverts to white. */
  tone?: "dark" | "light";
  /** Use the wider, shorter compact wordmark (suited to inline / nav strips). */
  compact?: boolean;
  /** Tailwind classes for sizing the rendered image (height first, width auto). */
  className?: string;
  /** Override the alt text. Defaults to the foundation name. */
  alt?: string;
}

export function JwfLogo({
  tone = "dark",
  compact = false,
  className,
  alt = "John Whitgift Foundation",
}: JwfLogoProps) {
  const src = compact ? "/jwf-logo-compact.png" : "/jwf-logo.png";
  const width = compact ? 105 : 144;
  const height = compact ? 80 : 150;

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority
      className={cn(
        "h-auto w-auto select-none",
        tone === "light" && "brightness-0 invert",
        className,
      )}
    />
  );
}
