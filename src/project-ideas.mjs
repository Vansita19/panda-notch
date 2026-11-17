import {normalizePinURL} from './links.mjs';

export const projectIdeaLimits = {count:300, title:200, notes:20000, links:12, linkLength:2000};
// Keep this collection well below the native backup size limit, even with long notes.
const collectionBytes = 750_000;
const encoder = new TextEncoder();
const fields = ['id', 'title', 'notes', 'links', 'created', 'updated'];
const appearanceFields = ['icon', 'color'];
export const projectIdeaColors = ['lavender', 'mint', 'peach', 'blue', 'rose', 'amber'];
export const projectIdeaSymbols = [
 {id:'layers', label:'Layers'},
 {id:'palette', label:'Palette'},
 {id:'leaf', label:'Leaf'},
 {id:'headphones', label:'Headphones'},
 {id:'compass', label:'Compass'},
 {id:'gamepad', label:'Gamepad'},
 {id:'book', label:'Book'},
 {id:'sparkles', label:'Sparkles'},
 {id:'code', label:'Code'},
 {id:'heart', label:'Heart'},
 {id:'zap', label:'Lightning'},
 {id:'utensils', label:'Food'},
];
export const projectIdeaIcons = ['✨', '🌱', '🎨', '🧩', '🚀', '🪴', '🎧', '🧭', '📚', '💡', '🌊', '🍊', '🪐', '🎮', '🛠️', '💻'];
export const validProjectIdeaIcon = value =>
 typeof value === 'string' && value === value.trim() && value.length > 0 &&
 value.length <= 32 && !/[\x00-\x1f\x7f]/.test(value) &&
 (!value.startsWith('symbol:') || projectIdeaSymbols.some(symbol => value === `symbol:${symbol.id}`));

const appearanceRules = [
 {words:/garden|plant|grow|nature|eco|sustain|habit|wellness/i, icon:'symbol:leaf', color:'mint'},
 {words:/music|audio|sound|playlist|podcast/i, icon:'symbol:headphones', color:'lavender'},
 {words:/design|art|draw|paint|creativ|portfolio|studio/i, icon:'symbol:palette', color:'peach'},
 {words:/travel|trip|map|explore|adventure|wander/i, icon:'symbol:compass', color:'blue'},
 {words:/game|play|fun|arcade/i, icon:'symbol:gamepad', color:'rose'},
 {words:/read|book|learn|study|course/i, icon:'symbol:book', color:'amber'},
 {words:/space|star|cosm|planet/i, icon:'symbol:sparkles', color:'lavender'},
 {words:/food|cook|recipe|meal/i, icon:'symbol:utensils', color:'peach'},
 {words:/web|app|code|tool|build|software|component|library|interface|prototype/i, icon:'symbol:layers', color:'blue'},
];

export function projectIdeaAppearance(idea) {
 const text = idea.title ?? '';
 const match = appearanceRules.find(rule => rule.words.test(text));
 let hash = 0;
 for (const character of idea.id ?? text) hash = (hash * 31 + character.codePointAt(0)) >>> 0;
 return {
  icon:validProjectIdeaIcon(idea.icon) ? idea.icon : match?.icon ?? `symbol:${projectIdeaSymbols[hash % projectIdeaSymbols.length].id}`,
  color:projectIdeaColors.includes(idea.color) ? idea.color : match?.color ?? projectIdeaColors[hash % projectIdeaColors.length],
 };
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function projectIdeaLink(value) {
 if (typeof value !== 'string') return null;
 const raw = value.trim();
 if (!raw || raw.length > projectIdeaLimits.linkLength) return null;
 try {
  const normalized = normalizePinURL(raw);
  return /^https?:\/\//.test(normalized) && normalized.length <= projectIdeaLimits.linkLength ? normalized : null;
 } catch {
  return null;
 }
}

function validProjectIdea(idea) {
 return idea !== null && typeof idea === 'object' &&
  Object.getPrototypeOf(idea) === Object.prototype &&
  Object.keys(idea).every(field => fields.includes(field) || appearanceFields.includes(field)) &&
  fields.every(field => Object.hasOwn(idea, field)) &&
  (idea.icon === undefined || validProjectIdeaIcon(idea.icon)) &&
  (idea.color === undefined || projectIdeaColors.includes(idea.color)) &&
  typeof idea.id === 'string' && uuid.test(idea.id) &&
  typeof idea.title === 'string' && !!idea.title && idea.title === idea.title.trim() &&
  idea.title.length <= projectIdeaLimits.title &&
  typeof idea.notes === 'string' && idea.notes.length <= projectIdeaLimits.notes &&
  Number.isFinite(idea.created) && Number.isFinite(idea.updated) &&
  Array.isArray(idea.links) && idea.links.length <= projectIdeaLimits.links &&
  new Set(idea.links).size === idea.links.length &&
  idea.links.every(link => typeof link === 'string' && projectIdeaLink(link) === link);
}

export function validProjectIdeas(ideas) {
 return Array.isArray(ideas) && ideas.length <= projectIdeaLimits.count &&
  ideas.every(validProjectIdea) && new Set(ideas.map(idea => idea.id)).size === ideas.length &&
  encoder.encode(JSON.stringify(ideas)).byteLength <= collectionBytes;
}

export function saveProjectIdea(ideas, draft, now) {
 if (!draft || typeof draft.id !== 'string' || !uuid.test(draft.id)) throw Error('This idea could not be saved.');
 if (typeof draft.title !== 'string' || !draft.title.trim() || draft.title.trim().length > projectIdeaLimits.title) {
  throw Error('Give the idea a title of 200 characters or fewer.');
 }
 if (typeof draft.notes !== 'string' || draft.notes.length > projectIdeaLimits.notes) {
  throw Error('Keep the notes under 20,000 characters.');
 }
 if (!Array.isArray(draft.links) || draft.links.length > projectIdeaLimits.links) {
  throw Error('An idea can have up to 12 reference links.');
 }
 const links = draft.links.map(projectIdeaLink);
 if (links.some(link => !link)) throw Error('Use web links for your references.');
 const previous = ideas.find(idea => idea.id === draft.id);
 if (!previous && ideas.length >= projectIdeaLimits.count) throw Error('You’ve reached the limit of 300 ideas.');
 const icon = draft.icon === undefined ? previous?.icon : draft.icon;
 const color = draft.color === undefined ? previous?.color : draft.color;
 if (icon !== undefined && !validProjectIdeaIcon(icon)) throw Error('Choose an emoji or a short icon of up to 32 characters.');
 if (color !== undefined && !projectIdeaColors.includes(color)) throw Error('Choose a color for this idea.');
 const idea = {
  id:draft.id,
  title:draft.title.trim(),
  notes:draft.notes,
  links:[...new Set(links)],
  created:previous?.created ?? now,
  updated:now,
  ...(icon === undefined ? {} : {icon}),
  ...(color === undefined ? {} : {color}),
 };
 if (previous && idea.icon === previous.icon && idea.color === previous.color && idea.title === previous.title && idea.notes === previous.notes &&
     idea.links.length === previous.links.length && idea.links.every((link,index) => link === previous.links[index])) {
  return ideas;
 }
 const next = [idea, ...ideas.filter(item => item.id !== idea.id)];
 if (!validProjectIdeas(next)) throw Error('Ideas storage is full. Shorten this note or remove an idea to make room.');
 return next;
}

export function restoreProjectIdea(ideas, idea, index) {
 if (!validProjectIdea(idea) || ideas.some(item => item.id === idea.id)) return ideas;
 const next = ideas.slice();
 next.splice(Number.isInteger(index) ? Math.max(0, index) : next.length, 0, idea);
 return validProjectIdeas(next) ? next : ideas;
}
