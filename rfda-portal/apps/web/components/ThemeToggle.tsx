'use client';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';

type Theme = 'light' | 'dark' | 'system';
const KEY = 'rfda-theme';
const NEXT: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const LABEL: Record<Theme, [string, string]> = { light: ['sun', 'Light'], dark: ['moon', 'Dark'], system: ['monitor', 'System'] };

/** Runs in <head> before the page paints. "system" removes the attribute so the CSS media query decides. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}')||'light';if(t==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

function apply(t: Theme) {
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

/** Cycles light → dark → system. The choice is kept in this browser. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');
  useEffect(() => {
    try { const t = localStorage.getItem(KEY) as Theme | null; if (t && t in NEXT) setTheme(t); } catch { /* storage unavailable */ }
  }, []);
  const change = () => {
    const t = NEXT[theme];
    setTheme(t);
    apply(t);
    try { localStorage.setItem(KEY, t); } catch { /* storage unavailable: applies to this page only */ }
  };
  const [icon, label] = LABEL[theme];
  return (
    <button className="btn small" onClick={change} aria-label={`Colour theme: ${label}. Change theme`} title={`Theme: ${label} (click to change)`}>
      <Icon name={icon} /><span className="lbl">{label}</span>
    </button>
  );
}
