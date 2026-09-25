import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  onChange: (value: number) => void;
  // Displayed value = stored value / scale (e.g. scale 1000 shows ms as seconds).
  scale?: number;
  decimals?: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  width?: number;
  ariaLabel?: string;
}

// Number input that lets you type freely and only commits valid numbers,
// so the cursor doesn't jump while editing.
export function NumField({
  value,
  onChange,
  scale = 1,
  decimals = 0,
  min,
  max,
  step,
  suffix,
  width = 72,
  ariaLabel,
}: Props) {
  const format = (v: number) => (Number.isFinite(v) ? (v / scale).toFixed(decimals) : "");
  const [text, setText] = useState(format(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, scale, decimals]);

  const commit = (raw: string): number | undefined => {
    const n = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(n)) return undefined;
    let v = Math.round(n * scale);
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    if (v !== value) onChange(v);
    return v;
  };

  return (
    <span className="numfield">
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        style={{ width }}
        value={text}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setText(format(value));
        }}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const s = (step ?? 1) * (e.shiftKey ? 10 : 1) * (e.key === "ArrowUp" ? 1 : -1);
            const next = Math.round(value / scale / (step ?? 1)) * (step ?? 1) + s;
            const v = commit(String(next));
            if (v !== undefined) setText(format(v));
          }
        }}
      />
      {suffix && <span className="numfield-suffix">{suffix}</span>}
    </span>
  );
}
