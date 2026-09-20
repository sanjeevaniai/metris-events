import logoAsset from "@/assets/metris-logo.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Official METRIS mark + wordmark. The mark is used exactly as supplied
 * (no recolouring, no substitutions).
 */
export function BrandLogo({
  className,
  wordmarkClassName,
}: {
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <img
        src={logoAsset.url}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
      />
      <span
        className={cn(
          "text-[1.3125rem] font-semibold tracking-[0.22em] sm:text-[1.5rem]",
          wordmarkClassName,
        )}
      >
        METRIS
      </span>
    </span>
  );
}
