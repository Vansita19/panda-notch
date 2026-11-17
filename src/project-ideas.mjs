import {normalizePinURL} from './links.mjs';

export const projectIdeaLimits = {count:300, title:200, notes:20000, links:12, linkLength:2000};
// Keep this collection well below the native backup size limit, even with long notes.
const collectionBytes = 750_000;
const encoder = new TextEncoder();
const fields = ['id', 'title', 'notes', 'links', 'created', 'updated'];
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
  Object.keys(idea).length === fields.length && fields.every(field => Object.hasOwn(idea, field)) &&
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
 const idea = {
  id:draft.id,
  title:draft.title.trim(),
  notes:draft.notes,
  links:[...new Set(links)],
  created:previous?.created ?? now,
  updated:now,
 };
 if (previous && idea.title === previous.title && idea.notes === previous.notes &&
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
