import { useEffect, useState } from 'react';

// The screen on view tells Assistive Touch what can be done there ("Download folder", "Approve"…).
// Up to 3 actions; they fill the top row of the Assistive Touch menu while that screen is open.
let current = null; // { id, actions: [{ key, label, Icon, run, badge?, disabled? }] }
const subs = new Set();
const tell = () => subs.forEach((f) => f(current));

export function setScreenActions(id, actions) {
  const list = (actions || []).filter(Boolean).slice(0, 3);
  current = list.length ? { id, actions: list } : (current && current.id === id ? null : current);
  tell();
}
export function clearScreenActions(id) {
  if (current && current.id === id) { current = null; tell(); }
}

/** Assistive Touch: the actions of the screen on view (or null) */
export function useScreenActions() {
  const [a, setA] = useState(current);
  useEffect(() => { subs.add(setA); setA(current); return () => { subs.delete(setA); }; }, []);
  return a;
}

/** A screen: offer these actions while it is open. `deps` = what the actions depend on. */
export function useProvideScreenActions(id, actions, deps) {
  useEffect(() => {
    setScreenActions(id, actions);
    return () => clearScreenActions(id);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
