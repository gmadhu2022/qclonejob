import { IconLayers, IconClipboard, IconUser } from "./icons";

/**
 * List / Grid / Compact view switcher.
 *
 * Shared by Resume search and Manage jobs so the two screens don't drift into
 * different controls for the same idea. Each screen holds its own useState;
 * this component is presentation only.
 */

export const VIEWS = [
  { key: "grid", label: "Grid", icon: IconLayers, hint: "Cards side by side" },
  { key: "list", label: "List", icon: IconClipboard, hint: "One per row, more detail" },
  { key: "compact", label: "Compact", icon: IconUser, hint: "Dense table — scan many at once" },
];

export default function ViewSwitcher({ value, onChange, views = VIEWS }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {views.map((v) => (
        <button key={v.key} type="button" onClick={() => onChange(v.key)}
                title={v.hint} aria-pressed={value === v.key}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-semibold transition-all
                  ${value === v.key ? "bg-white text-navy shadow-sm" : "text-slate-500 hover:text-navy"}`}>
          <v.icon size={14} />
          <span className="hidden sm:inline">{v.label}</span>
        </button>
      ))}
    </div>
  );
}
