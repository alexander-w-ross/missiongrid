export function Legend() {
  return (
    <div className="panel p-3">
      <div className="label mb-2">Legend</div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[11px] text-[color:var(--color-muted)]">
        <Item label="Responder">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-[color:var(--color-cyan)]" />
        </Item>
        <Item label="Fighting fire">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-[color:var(--color-amber)]" />
        </Item>
        <Item label="Fire">
          <span className="inline-block h-3 w-3 rounded-full bg-[color:var(--color-fire)]" />
        </Item>
        <Item label="Mountain">
          <span className="inline-block h-3 w-3 border border-[color:var(--color-mountain-edge)] bg-[color:var(--color-mountain)]" />
        </Item>
        <Item label="Mission ctrl">
          <span className="inline-block h-3 w-3 border-2 border-[color:var(--color-mc)]" />
        </Item>
        <Item label="Signal lost">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[color:var(--color-red)]" />
        </Item>
      </ul>
    </div>
  );
}

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex h-3 w-3 items-center justify-center">{children}</span>
      <span>{label}</span>
    </li>
  );
}
