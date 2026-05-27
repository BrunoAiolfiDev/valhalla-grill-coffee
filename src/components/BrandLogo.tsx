"use client";

import Image from "next/image";

type BrandLogoProps = {
  variant: "yellow" | "black";
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({
  variant,
  width = 220,
  height = 64,
  className,
  priority = false,
}: BrandLogoProps) {
  const src =
    variant === "yellow" ? "/brand/logo-yellow.png" : "/brand/logo-black.png";

  return (
    <Image
      src={src}
      alt="Valhalla Grill & Coffee"
      width={width}
      height={height}
      priority={priority}
      className={className}
    />
  );
}
