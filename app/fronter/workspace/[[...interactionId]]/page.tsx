import { FronterWorkspaceClient } from './client'

/**
 * Static export cannot invent interaction IDs at build time. Emit the shell at
 * `/fronter/workspace/`; the client reads the id from the path (or `?id=`).
 * Deep links like `/fronter/workspace/<id>/` need the CDN to serve this shell
 * (S3 + CloudFront rewrite) — client-side navigations can use `?id=` instead.
 */
export function generateStaticParams() {
  return [{ interactionId: [] }]
}

export default function FronterWorkspacePage() {
  return <FronterWorkspaceClient />
}
