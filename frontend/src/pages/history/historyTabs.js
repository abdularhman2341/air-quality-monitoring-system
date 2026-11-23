// The History tabs and their one panel (WAI-ARIA tabs pattern, F17). Kept
// apart from the components so HistoryFilters and ResultsCard share the ids.
export const TABS = ['alerts', 'readings']
export const TAB_PANEL_ID = 'history-panel'
export const tabId = (name) => `history-tab-${name}`

// The tab a key moves to, or null for any other key. With two tabs, either
// arrow goes to the other one in both page directions.
export function tabForKey(key, current) {
  const index = TABS.indexOf(current)
  const moves = {
    ArrowRight: (index + 1) % TABS.length,
    ArrowLeft: (index - 1 + TABS.length) % TABS.length,
    Home: 0,
    End: TABS.length - 1
  }
  return key in moves ? TABS[moves[key]] : null
}
