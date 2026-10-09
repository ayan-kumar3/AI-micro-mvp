"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme, type Theme } from "./theme-context";

const OPTIONS: Array<{ value: Theme; label: string }> = [
  { value: "moss", label: "Moss" },
  { value: "amethyst", label: "Amethyst" },
  { value: "tide", label: "Tide" },
];

export default function ThemeControl() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const controlRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !controlRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function selectTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="theme-control" ref={controlRef}>
      <button
        aria-expanded={isOpen}
        aria-label="Theme"
        aria-controls="theme-options"
        className="theme-trigger"
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <span className="theme-swatches" aria-hidden="true">
          <i className="theme-swatch-moss" />
          <i className="theme-swatch-amethyst" />
          <i className="theme-swatch-tide" />
        </span>
        <span>Theme</span>
        <svg aria-hidden="true" className={`theme-chevron${isOpen ? " is-open" : ""}`} viewBox="0 0 16 16">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div aria-label="Choose a theme" className="theme-popover" id="theme-options" role="group">
          {OPTIONS.map((option) => (
            <button
              aria-pressed={theme === option.value}
              className={`theme-option${theme === option.value ? " is-selected" : ""}`}
              key={option.value}
              onClick={() => selectTheme(option.value)}
              type="button"
            >
              <span aria-hidden="true" className={`theme-option-swatch theme-option-swatch-${option.value}`} />
              <span>{option.label}</span>
              {theme === option.value && (
                <svg aria-hidden="true" className="theme-option-check" viewBox="0 0 16 16">
                  <path d="m3 8 3.2 3.2L13 4.5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
