import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon,
  count,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  icon?: ReactNode;
  count?: number | string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex min-h-0 flex-col", className)}>
      <header className="flex items-center gap-2 border-b border-[color:var(--color-line)] px-3 py-2">
        {icon && <span className="text-[color:var(--color-teal)]">{icon}</span>}
        <h2 className="font-display text-sm tracking-wide text-[color:var(--color-ink)]">
          {title}
        </h2>
        {count !== undefined && (
          <span className="font-mono text-[11px] text-[color:var(--color-faint)]">
            [{count}]
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
