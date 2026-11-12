import { Code } from "@phosphor-icons/react";
import { useEditorState } from "./editorState";
import "./editor.css";

export default function DeveloperSettings() {
  const { enabled, setEnabled } = useEditorState();
  return <div className="admin-detail-page" data-developer-controls>
    <div className="page-title"><div><h1>Developer Mode</h1><p className="muted">Adjust the interface in your local development environment.</p></div></div>
    <section className="card stack" aria-labelledby="developer-editor-title">
      <div className="developer-settings-heading">
        <div className="stack" style={{ gap: 8 }}><h2 id="developer-editor-title" className="row"><Code size={22} aria-hidden="true" /> UI editor</h2><p className="muted">Move, resize and edit text, then export your changes for the codebase.</p></div>
        <button type="button" className={`btn ${enabled ? "" : "primary"}`} role="switch" aria-checked={enabled} aria-label="Enable UI editor" onClick={() => setEnabled(!enabled)}>{enabled ? "Disable developer mode" : "Enable developer mode"}</button>
      </div>
      <span className={`badge ${enabled ? "ok" : ""}`} style={{ alignSelf: "flex-start" }}>{enabled ? "Enabled" : "Disabled"}</span>
      <p className="muted">{enabled ? "Use the floating UI editor button on any preview page. Turn selection off to use navigation and app controls." : "The UI editor and its preview changes are turned off. Enable it to continue editing."}</p>
      <small className="muted">Your saved edits are kept when disabled. This control and the editor are excluded from production builds. Use the mock controls to preview other account types after enabling the editor.</small>
    </section>
  </div>;
}
