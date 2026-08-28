import { cn } from "@/lib/utils";
import emblem from "@/assets/saft-media-emblem.png";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "on-light" | "on-dark";
  showImage?: boolean;
  logo?: "church" | "login";
  showSubtitle?: boolean;
  title?: string;
}


const sizes = {
  sm: { img: "h-8", tag: "text-[9px]" },
  md: { img: "h-10", tag: "text-[10px]" },
  lg: { img: "h-14", tag: "text-xs" },
  xl: { img: "h-20", tag: "text-sm" },
};

export function BrandLogo({
  className,
  size = "md",
  variant = "on-light",
  showImage = true,
  
  showSubtitle = true,
  title = "Media Team",
}: BrandLogoProps) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      {showImage && (
        <img
          src={emblem}
          alt="SAFT Media Team logo"
          width={512}
          height={512}
          className={cn(s.img, "w-auto shrink-0 object-contain")}
        />
      )}
      <div className="leading-tight">
        <div
          className={cn(
            "font-bold uppercase tracking-tight",
            variant === "on-dark" ? "text-primary-foreground" : "text-foreground",
            size === "xl" ? "text-xl" : size === "lg" ? "text-lg" : "text-sm",
          )}
        >
          {title}
        </div>
        {showSubtitle && (
          <div
            className={cn(
              s.tag,
              "font-medium uppercase tracking-[0.18em]",
              variant === "on-dark" ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            SAFT Church
          </div>
        )}
      </div>
    </div>
  );
}

