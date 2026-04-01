/** @format */

export const INSPECTOR_TABS = [
  "overview",
  "hooks",
  "markdown",
  "output",
] as const
export type InspectorTab = (typeof INSPECTOR_TABS)[number]
