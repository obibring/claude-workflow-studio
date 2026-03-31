/** @format */

export const INSPECTOR_TABS = [
  "overview",
  "hooks",
  "markdown",
  "scripts",
  "output",
] as const
export type InspectorTab = (typeof INSPECTOR_TABS)[number]
