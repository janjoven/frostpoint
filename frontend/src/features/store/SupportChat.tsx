import { Navigate } from "react-router-dom";
import { Chat } from "../../components/Chat";
import { useAuth } from "../../store";

export default function SupportChat() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  if (!ready) return null;
  if (!user) return <Navigate to="/login" state={{ from: "/support" }} replace />;
  return (
    <div className="stack" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h1>Support</h1>
      <p className="muted">Message the FROSTPOINT team about an order or delivery.</p>
      <div className="card"><Chat path="/support/mine" me="customer" /></div>
    </div>
  );
}
