// The wiki UI is rendered by the layout, which survives navigation between
// /wiki and /wiki/<id>; remounting it per page would re-run the tab-restore
// effect against an already-changed URL. WikiClient reads wikiPageId itself.
export default function OrgWikiPageDetail() {
  return null;
}
