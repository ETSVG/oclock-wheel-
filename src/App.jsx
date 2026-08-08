import Wheel from "./Wheel";
import Admin from "./Admin";

export default function App() {
  // /admin ou ?admin -> page admin, sinon la roue
  const isAdmin =
    window.location.pathname.replace(/\/$/, "").endsWith("/admin") ||
    new URLSearchParams(window.location.search).has("admin");
  return isAdmin ? <Admin /> : <Wheel />;
}
