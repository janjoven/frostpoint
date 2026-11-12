import LayoutEditor from "./LayoutEditor";
import { useEditorState } from "./editorState";

export default function EditorHost() {
  const enabled = useEditorState((state) => state.enabled);
  return enabled ? <LayoutEditor /> : null;
}
