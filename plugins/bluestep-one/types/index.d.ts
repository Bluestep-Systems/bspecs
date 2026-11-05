// The value the tab-guard mod (hooks/register.tsx) keeps in $.state while a call is held, so its pane and band survive
// a hot reload. Nothing is kept once the call is answered.

// The site a held script would write to, as the mod could tell.
export type TabGuardTarget = {
  // The origin a fetch in the script names, or else the one its tab is on now (the browser's tab
  // list, read just before the card shows); undefined when neither could be read.
  origin?: string;
};

// The call held for the person's answer.
export type TabGuardHeld = {
  toolUseId: string;
  tool: string;
  // What each changing script says it does, from its opening comment (Claude's words), or, for a
  // build or publish of an own component with no comment, the mod's own words. Any other script
  // with no such comment is sent back to Claude and never held.
  summaries: string[];
  // Whether the mutation and its values are unfolded (`Show details`).
  showDetails: boolean;
  mutations: string[];
  // The variables sent with them, as written in the script (`variables: { ... }`).
  values: string[];
  target: TabGuardTarget;
  where: 'pane' | 'band';
};

declare module 'claude-code' {
  interface PluginState {
    'bluestep-one': {
      held: TabGuardHeld | null;
    };
  }
}
