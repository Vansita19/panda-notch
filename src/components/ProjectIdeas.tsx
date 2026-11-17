import {useId, useLayoutEffect, useRef, useState} from 'react';
import type {FormEvent} from 'react';
import {ArrowLeft, ArrowUpRight, Check, Link2, Pencil, Plus, Trash2, X} from 'lucide-react';
import {Button} from '../arc/button/button';
import {host, native} from '../bridge';
import {projectIdeaLimits, projectIdeaLink, projectIdeaAppearance, projectIdeaColors, projectIdeaIcons, projectIdeaSymbols, validProjectIdeaIcon} from '../project-ideas.mjs';
import {ProjectIdeaIcon} from './ProjectIdeaIcon';
import './project-ideas.css';

export type IdeaColor = 'lavender' | 'mint' | 'peach' | 'blue' | 'rose' | 'amber';

export type ProjectIdea = {
  id: string;
  title: string;
  notes: string;
  links: string[];
  created: number;
  updated: number;
  icon?: string;
  color?: IdeaColor;
};

type IdeaDraft = Pick<ProjectIdea, 'id' | 'title' | 'notes' | 'links' | 'icon' | 'color'>;
type IdeaField = 'title' | 'icon' | number;

export type ProjectIdeasSession = {
  selectedId: string | null;
  draft: IdeaDraft | null;
  previousSelection: string | null;
};

type Props = {
  ideas: ProjectIdea[];
  onSave: (idea: IdeaDraft) => void;
  onDelete: (id: string) => void;
  wide?: boolean;
  session?: ProjectIdeasSession;
};

export function ProjectIdeas({ideas, onSave, onDelete, wide = false, session}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(() => session?.selectedId ?? null);
  const [draft, setDraft] = useState<IdeaDraft | null>(() => session?.draft ?? null);
  const [error, setError] = useState<{field: IdeaField | 'form'; message: string} | null>(null);
  const inputPrefix = useId();
  const editorRef = useRef<HTMLFormElement>(null);
  const detailTitle = useRef<HTMLHeadingElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const nextFocus = useRef<IdeaField | 'detail' | 'new' | null>(null);
  const previousSelection = useRef<string | null>(session?.previousSelection ?? null);
  const selected = ideas.find(idea => idea.id === selectedId);
  const preview = selected;
  const draftAppearance = draft ? projectIdeaAppearance(draft) : null;
  const previewAppearance = preview ? projectIdeaAppearance(preview) : null;
  const showingIdea = !!(selected || draft);

  useLayoutEffect(() => {
    if (!session) return;
    session.selectedId = selectedId;
    session.draft = draft;
    session.previousSelection = previousSelection.current;
  }, [session, selectedId, draft]);

  useLayoutEffect(() => {
    const field = nextFocus.current;
    if (field === null) return;
    nextFocus.current = null;
    if (field === 'detail') detailTitle.current?.focus();
    else if (field === 'new') newButton.current?.focus();
    else {
      const input = editorRef.current?.elements.namedItem(String(field));
      if (input instanceof HTMLElement) input.focus();
    }
  }, [draft, selectedId, error]);

  function startEditing(idea?: ProjectIdea, focus: 'title' | 'icon' = 'title') {
    previousSelection.current = selected?.id ?? null;
    nextFocus.current = focus;
    setError(null);
    setDraft(idea ? {...idea, links: idea.links.length ? [...idea.links] : ['']} : {
      id: crypto.randomUUID(),
      title: '',
      notes: '',
      links: ['']
    });
  }

  function cancel() {
    const previous = previousSelection.current;
    nextFocus.current = previous ? 'detail' : 'new';
    setSelectedId(previous);
    setDraft(null);
    setError(null);
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      nextFocus.current = 'title';
      setError({field: 'title', message: 'Enter a project name.'});
      return;
    }
    if (draft.icon !== undefined && !validProjectIdeaIcon(draft.icon)) {
      nextFocus.current = 'icon';
      setError({field: 'icon', message: 'Choose an emoji or a short icon.'});
      return;
    }
    const links = new Set<string>();
    for (const [index, input] of draft.links.entries()) {
      if (!input.trim()) continue;
      const link = projectIdeaLink(input);
      if (!link) {
        nextFocus.current = index;
        setError({field: index, message: 'Enter a website link, such as example.com.'});
        return;
      }
      links.add(link);
    }
    try {
      onSave({id: draft.id, title, notes: draft.notes, links: [...links], icon: draftAppearance!.icon, color: draftAppearance!.color});
    } catch (failure) {
      setError({
        field: 'form',
        message: failure instanceof Error ? failure.message : 'Could not save this idea. Your draft is still here.'
      });
      return;
    }
    nextFocus.current = 'detail';
    setSelectedId(draft.id);
    setDraft(null);
    setError(null);
  }

  function openIdea(id: string) {
    if (id === selectedId) {
      detailTitle.current?.focus();
      return;
    }
    nextFocus.current = 'detail';
    setSelectedId(id);
  }

  function changeField(field: 'title' | 'notes' | 'icon', value: string) {
    setDraft(current => current && {...current, [field]: value});
    if (error?.field === field || error?.field === 'form') setError(null);
  }

  function changeLink(index: number, value: string) {
    setDraft(current => current && {...current, links: current.links.map((link, i) => i === index ? value : link)});
    if (error?.field === index || error?.field === 'form') setError(null);
  }

  function removeLink(index: number) {
    if (!draft) return;
    const links = draft.links.filter((_, i) => i !== index);
    nextFocus.current = Math.min(index, Math.max(0, links.length - 1));
    setDraft({...draft, links: links.length ? links : ['']});
    setError(null);
  }

  const errorId = `${inputPrefix}-error`;

  return (
    <section className="project-ideas" aria-label="Project ideas" data-wide={wide} data-showing-idea={showingIdea} data-editing={!!draft}>
      <header className="project-ideas-heading">
        {showingIdea && !draft
          ? <Button type="button" variant="ghost" size="sm" className="project-ideas-back" onClick={() => {
              nextFocus.current = 'new';
              setSelectedId(null);
            }}><ArrowLeft size={14} aria-hidden="true" /> All ideas</Button>
          : <h1>Ideas</h1>}
        {!draft && <Button ref={newButton} type="button" variant="secondary" size="sm"
          disabled={ideas.length >= projectIdeaLimits.count} onClick={() => startEditing()}>
          <Plus size={14} aria-hidden="true" /> New idea
        </Button>}
      </header>

      {ideas.length >= projectIdeaLimits.count && !draft && <p className="project-ideas-limit">Remove an idea before adding another.</p>}

      <div className="project-ideas-layout" data-has-list={ideas.length > 0}>
        <div className="project-ideas-library" inert={draft ? true : undefined}>
          {ideas.length ? <ul aria-label="Saved ideas">
            {ideas.map(idea => {
              const appearance = projectIdeaAppearance(idea);
              return <li key={idea.id}>
                <button type="button" className="project-idea-card" data-color={appearance.color}
                  aria-label={idea.title} aria-current={preview?.id === idea.id ? 'true' : undefined}
                  onClick={() => openIdea(idea.id)}>
                  <span className="project-idea-emblem"><ProjectIdeaIcon icon={appearance.icon} /></span>
                  <span className="project-idea-card-copy">
                    <strong>{idea.title}</strong>
                    {idea.notes.trim() && <span className="project-idea-card-preview">{idea.notes}</span>}
                  </span>
                </button>
              </li>;
            })}
          </ul> : <p className="project-ideas-empty">Save a project you want to build.</p>}
        </div>

        {draft ? (
          <form className="project-idea-editor" ref={editorRef} aria-label={ideas.some(idea => idea.id === draft.id) ? 'Edit idea' : 'New idea'}
            onSubmit={save} onKeyDown={event => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                cancel();
              }
            }}>
            <fieldset className="project-idea-appearance" data-color={draftAppearance!.color}>
              <legend>Project icon</legend>
              <div className="project-idea-icon-edit">
                <span className="project-idea-emblem"><ProjectIdeaIcon icon={draftAppearance!.icon} /></span>
                <label className="project-idea-field">
                  Icon or emoji
                  <input name="icon" value={draftAppearance!.icon.startsWith('symbol:') ? '' : draft.icon ?? draftAppearance!.icon} maxLength={32} placeholder="Paste an emoji"
                    aria-invalid={error?.field === 'icon' || undefined} aria-describedby={error?.field === 'icon' ? errorId : undefined}
                    onChange={event => changeField('icon', event.target.value)} />
                </label>
              </div>
              <div className="project-idea-symbol-options" role="group" aria-label="Choose a project symbol">
                {projectIdeaSymbols.map((symbol: {id: string; label: string}) => <button key={symbol.id} type="button"
                  aria-label={`Use ${symbol.label} icon`} title={symbol.label}
                  aria-pressed={draftAppearance!.icon === `symbol:${symbol.id}`} onClick={() => changeField('icon', `symbol:${symbol.id}`)}>
                  <ProjectIdeaIcon icon={`symbol:${symbol.id}`} />
                </button>)}
              </div>
              <div className="project-idea-emoji-options" role="group" aria-label="Choose a project emoji">
                {projectIdeaIcons.map((icon: string) => <button key={icon} type="button" aria-label={`Use ${icon} icon`}
                  aria-pressed={draftAppearance!.icon === icon} onClick={() => changeField('icon', icon)}>{icon}</button>)}
              </div>
              <div className="project-idea-color-options" role="group" aria-label="Icon color">
                {projectIdeaColors.map((color: IdeaColor) => <button key={color} type="button" data-color={color}
                  aria-label={`Use ${color} color`} title={color.charAt(0).toUpperCase() + color.slice(1)}
                  aria-pressed={draftAppearance!.color === color} onClick={() => setDraft(current => current && {...current, color})}>
                  {draftAppearance!.color === color && <Check size={12} aria-hidden="true" />}
                </button>)}
              </div>
            </fieldset>
            <label className="project-idea-field">
              Project name
              <input name="title" value={draft.title} maxLength={projectIdeaLimits.title} aria-required="true"
                aria-invalid={error?.field === 'title' || undefined} aria-describedby={error?.field === 'title' ? errorId : undefined}
                placeholder="What do you want to build?" onChange={event => changeField('title', event.target.value)} />
            </label>
            <label className="project-idea-field">
              Notes
              <textarea name="notes" value={draft.notes} maxLength={projectIdeaLimits.notes} rows={4}
                placeholder="Sketch the idea or a first step" onChange={event => changeField('notes', event.target.value)} />
            </label>
            <fieldset className="project-idea-references">
              <legend>Reference links</legend>
              {draft.links.map((url, index) => (
                <div className="project-idea-link-field" key={index}>
                  <input name={String(index)} value={url} maxLength={projectIdeaLimits.linkLength} aria-label={`Reference link ${index + 1}`}
                    aria-invalid={error?.field === index || undefined} aria-describedby={error?.field === index ? errorId : undefined}
                    inputMode="url" autoCapitalize="off" spellCheck={false}
                    placeholder="Paste a link" onChange={event => changeLink(index, event.target.value)} />
                  {(url || draft.links.length > 1) && <Button type="button" variant="ghost" size="sm" className="project-idea-icon-button"
                    aria-label={`Remove reference link ${index + 1}`} onClick={() => removeLink(index)}>
                    <X size={14} aria-hidden="true" />
                  </Button>}
                </div>
              ))}
              {draft.links.length < projectIdeaLimits.links && <Button type="button" variant="ghost" size="sm" className="project-idea-add-link" onClick={() => {
                nextFocus.current = draft.links.length;
                setDraft({...draft, links: [...draft.links, '']});
              }}>
                <Plus size={13} aria-hidden="true" /> Add link
              </Button>}
            </fieldset>
            {error && <p className="project-idea-error" id={errorId} role="alert">{error.message}</p>}
            <div className="project-idea-actions">
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm">Save idea</Button>
            </div>
          </form>
        ) : preview && (
          <article className="project-idea-detail" data-color={previewAppearance!.color}>
            <header className="project-idea-detail-heading">
              <div className="project-idea-identity">
                <button type="button" className="project-idea-emblem" aria-label="Change project icon" title="Change icon"
                  onClick={() => startEditing(preview, 'icon')}><ProjectIdeaIcon icon={previewAppearance!.icon} /></button>
                <h2 ref={detailTitle} tabIndex={-1}>{preview.title}</h2>
              </div>
              <div className="project-idea-detail-actions">
                <Button type="button" variant="ghost" size="sm" className="project-idea-icon-button" aria-label="Edit idea"
                  title="Edit idea" onClick={() => startEditing(preview)}><Pencil size={14} aria-hidden="true" /></Button>
                <Button type="button" variant="ghost" size="sm" className="project-idea-icon-button" aria-label="Delete idea"
                  title="Delete idea" onClick={() => {
                    newButton.current?.focus();
                    setSelectedId(null);
                    onDelete(preview.id);
                  }}><Trash2 size={14} aria-hidden="true" /></Button>
              </div>
            </header>
            {preview.notes.trim() && <p className="project-idea-notes">{preview.notes}</p>}
            {preview.links.length > 0 && <section className="project-idea-saved-links" aria-label="Reference links">
              <h3>Reference links</h3>
              <ul>{preview.links.map(link => {
                const url = projectIdeaLink(link);
                if (!url) return null;
                const {hostname, pathname} = new URL(url);
                const label = pathname === '/' ? hostname : hostname + pathname;
                return <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" title={url}
                  onClick={event => {
                    if (!native) return;
                    event.preventDefault();
                    host('openIdeaLink', {url});
                  }}>
                  <Link2 size={14} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={13} aria-hidden="true" />
                </a></li>;
              })}</ul>
            </section>}
          </article>
        )}
      </div>
    </section>
  );
}
