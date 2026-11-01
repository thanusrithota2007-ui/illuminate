import { NavLink, Outlet, useNavigate } from "react-router-dom"; import { useAuth } from "../../auth/AuthContext.jsx";
const TABS = [["stories", "My Stories"], ["time-machine", "Time Machine"], ["skin", "Skin Analysis"], ["settings", "Account Settings"]];
export default function DashboardLayout() {
  const { signOut } = useAuth(), nav = useNavigate();
  return (<div className="page wall-paper dash">
    <aside className="dash-nav" aria-label="Your space"><p className="dash-title">My space</p>
      {TABS.map(([p, l]) => <NavLink key={p} to={p}>{l}</NavLink>)}
      <button className="link" onClick={async () => { await signOut(); nav("/"); }}>Log out</button></aside>
    <div className="dash-main"><Outlet /></div></div>);
}
