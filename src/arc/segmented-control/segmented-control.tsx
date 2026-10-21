"use client";

import { useEffect, useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./segmented-control.module.css";

export interface Segment { value: string; label: string; /** Optional content after the label, such as a badge. */ accessory?: ReactNode; }
export interface SegmentedControlProps {
  options: Segment[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  /** Called when the pointer or focus reaches an option, before it is chosen. Use it to start loading what that option shows. */
  onOptionIntent?: (value: string) => void;
  className?: string;
  /** Native Panda rail styling; the default Arc control remains unchanged. */
  variant?: "default" | "notch";
}

export default function SegmentedControl({ options, value, onValueChange, label, onOptionIntent, className, variant = "default" }: SegmentedControlProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const indicatorAnimation = useRef<Animation | null>(null);
  const indicatorReady = useRef(false);
  const keyboardSelection = useRef(false);
  const measureIndicator = useRef<(animate: boolean) => void>(() => {});
  const optionKey = JSON.stringify(options.map(option => [option.value, option.label]));

  // Only the tile transforms. Labels stay in normal layout at their final size.
  measureIndicator.current = (animate: boolean) => {
    if (variant !== "notch") return;
    const node = track.current, tile = indicator.current;
    const button = node?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!node || !tile || !button) return;
    const width = button.offsetWidth, height = button.offsetHeight;
    const x = button.offsetLeft, y = button.offsetTop;
    if (!width || !height) return;
    const transform = getComputedStyle(tile).transform;
    const matrix = transform === "none" ? null : new DOMMatrixReadOnly(transform);
    const oldX = matrix?.m41 ?? x;
    const oldWidth = tile.offsetWidth * (matrix?.a ?? 1);
    const instant = !animate || !indicatorReady.current || reduced || matchMedia('(prefers-reduced-motion: reduce)').matches || keyboardSelection.current || document.documentElement.dataset.reduced === "true" || document.documentElement.dataset.inputModality === "keyboard";
    indicatorAnimation.current?.cancel();
    tile.style.width = `${width}px`;
    tile.style.height = `${height}px`;
    tile.style.top = `${y}px`;
    tile.style.transform = `translateX(${x}px)`;
    tile.style.visibility = "visible";
    indicatorReady.current = true;
    if (instant || Math.abs(oldX-x)<.25 && Math.abs(oldWidth-width)<.25) { indicatorAnimation.current = null; return; }
    const animation = tile.animate([
      {transform:`translateX(${oldX}px) scaleX(${oldWidth / width})`},
      {transform:`translateX(${x}px) scaleX(1)`}
    ], {duration:160,easing:"cubic-bezier(.22,1,.36,1)"});
    indicatorAnimation.current = animation;
    animation.onfinish = () => { if (indicatorAnimation.current === animation) indicatorAnimation.current = null; };
  };
  useLayoutEffect(() => {
    if (variant !== "notch") { indicatorReady.current = false; indicatorAnimation.current?.cancel(); return; }
    measureIndicator.current(true);
  }, [variant,value,optionKey,reduced]);
  useLayoutEffect(() => {
    if (variant !== "notch" || !track.current) return;
    const update = () => measureIndicator.current(false);
    const observer = new ResizeObserver(update);
    observer.observe(track.current);
    track.current.querySelectorAll("button").forEach(button => observer.observe(button));
    return () => observer.disconnect();
  }, [variant,optionKey]);
  useEffect(() => () => indicatorAnimation.current?.cancel(), []);

  // When the options are wider than the container, the track scrolls inside itself. Edges fade only on the side with more to see.
  useLayoutEffect(() => {
    const node = track.current;
    if (!node) return;
    const edges = () => {
      const rest = node.scrollWidth - node.clientWidth - node.scrollLeft;
      node.toggleAttribute("data-fade-start", node.scrollLeft > 1);
      node.toggleAttribute("data-fade-end", rest > 1);
    };
    edges();
    node.addEventListener("scroll", edges, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(edges);
    observer?.observe(node);
    return () => { node.removeEventListener("scroll", edges); observer?.disconnect(); };
  }, [options.length]);

  // The selected option is always scrolled fully into view, with a little room so it clears the fade.
  const first = useRef(true);
  useEffect(() => {
    const node = track.current;
    const button = node?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!node || !button || node.scrollWidth <= node.clientWidth) { first.current = false; return; }
    const room = 20, start = button.offsetLeft - room, end = button.offsetLeft + button.offsetWidth + room - node.clientWidth;
    const left = node.scrollLeft > start ? start : node.scrollLeft < end ? end : node.scrollLeft;
    if (left !== node.scrollLeft) node.scrollTo({ left: Math.max(0, left), behavior: first.current || reduced || variant === "notch" && (keyboardSelection.current || document.documentElement.dataset.reduced === "true" || document.documentElement.dataset.inputModality === "keyboard") ? "auto" : "smooth" });
    first.current = false;
  }, [value, reduced,variant]);

  // Arrow keys, Home and End move the selection like a tab list; only the selected option is a tab stop.
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1;
    const target = event.key === "ArrowRight" || event.key === "ArrowDown" ? (selectedIndex === last ? 0 : selectedIndex + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (selectedIndex === 0 ? last : selectedIndex - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (target < 0 || !options[target]) return;
    event.preventDefault();
    keyboardSelection.current = true;
    onValueChange(options[target].value);
    track.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(options[target].value)}"]`)?.focus({ preventScroll: true });
  };

  return <div className={`${styles.root} ${variant === "notch" ? styles.notchRoot : ""} ${className ?? ""}`} role="group" aria-label={label}>
    <LayoutGroup id={id}><motion.div ref={track} layoutScroll className={`${styles.track} ${variant === "notch" ? styles.notchTrack : ""}`}>
      {variant === "notch" && <span ref={indicator} className={`${styles.selection} ${styles.notchSelection}`} aria-hidden="true" />}
      {options.map((option, index) => <button key={option.value} id={`${id}-${option.value}`} className={`${styles.button} ${variant === "notch" ? styles.notchButton : ""}`} type="button" onPointerDown={() => { keyboardSelection.current = false; }} data-value={option.value} aria-pressed={value === option.value} tabIndex={index === selectedIndex ? 0 : -1} onClick={() => onValueChange(option.value)} onKeyDown={onKeyDown} onPointerEnter={onOptionIntent ? () => onOptionIntent(option.value) : undefined} onFocus={onOptionIntent ? () => onOptionIntent(option.value) : undefined}>
        {variant !== "notch" && value === option.value && <motion.span className={styles.selection} layoutId="selection" layoutDependency={value} transition={reduced || document.documentElement.dataset.reduced==='true' || document.documentElement.dataset.inputModality==='keyboard' ? { duration: 0 } : {duration:motionTokens.duration.fast,ease:[...motionTokens.ease.standard]}} aria-hidden="true" />}
        <span className={styles.label}>{option.label}{option.accessory}</span>
      </button>)}
    </motion.div></LayoutGroup>
  </div>;
}
