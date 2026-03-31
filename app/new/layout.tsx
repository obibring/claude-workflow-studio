/** @format */

import { redirect } from "next/navigation"
import { dirname } from "node:path"

export default async function RedirectLayout() {
  const installationPathParts = dirname(import.meta.url)
    ?.replace(/^file:\/?\/?/g, "")
    .split("/")
  const installationPath = installationPathParts.slice(0, -1).join("/")
  redirect(`/project/${encodeURIComponent(installationPath)}`)
}
