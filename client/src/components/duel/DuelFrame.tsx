import type { ReactNode } from "react";
import stadiumBg from "@/assets/stadium-bg.jpg";

/** Locked 9:16 mobile frame with the blurred neon stadium backdrop. */
export default function DuelFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="grid min-h-[100dvh] w-full place-items-center bg-black">
      <div
        className={`relative aspect-[9/16] h-[100dvh] max-h-[100dvh] w-full max-w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-black select-none ${className}`}
      >
        <img
          src={stadiumBg}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-55 blur-[14px]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,0,102,0.16),transparent_55%),radial-gradient(circle_at_50%_82%,rgba(0,229,255,0.16),transparent_55%)]" />
        <div className="absolute inset-0 bg-black/65" />
        {children}
      </div>
    </div>
  );
}
