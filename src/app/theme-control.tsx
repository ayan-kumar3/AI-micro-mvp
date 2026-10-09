"use client";

import { useTheme, type Theme } from "./theme-context";

const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: "moss", label: "Moss" },
  { value: "amethyst", label: "Amethyst" },
  { value: "tide", label: "Tide" },
];

export default function ThemeControl() {
  const { theme, setTheme } = useTheme();

  function handleChange(value: string) {
    const nextTheme = OPTIONS.find((option) => option.value === value);
    if (nextTheme) setTheme(nextTheme.value);
  }

  return (
    <label className="theme-control">
      <span className="theme-swatches" aria-hidden="true"><i /><i /><i /></span>
      <span className="sr-only">Color theme</span>
      <select aria-label="Color theme" onChange={(event) => handleChange(event.target.value)} value={theme}>
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
