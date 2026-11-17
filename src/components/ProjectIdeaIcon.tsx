import {BookOpen, Code2, Compass, Gamepad2, Headphones, Heart, Layers3, Leaf, Palette, Sparkles, Utensils, Zap} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';

const symbols: Record<string, LucideIcon> = {
  layers: Layers3,
  palette: Palette,
  leaf: Leaf,
  headphones: Headphones,
  compass: Compass,
  gamepad: Gamepad2,
  book: BookOpen,
  sparkles: Sparkles,
  code: Code2,
  heart: Heart,
  zap: Zap,
  utensils: Utensils,
};

export function ProjectIdeaIcon({icon}: {icon: string}) {
  const name = icon.startsWith('symbol:') ? icon.slice(7) : '';
  const Symbol = symbols[name];
  if (Symbol) {
    return <Symbol className="project-idea-glyph" size={24} strokeWidth={2.6}
      fill={name === 'zap' || name === 'heart' ? 'currentColor' : 'none'} aria-hidden="true" />;
  }
  return <span className="project-idea-emoji" aria-hidden="true">{icon}</span>;
}
