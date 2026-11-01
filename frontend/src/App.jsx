import { useEffect } from "react"; import { Routes, Route, NavLink, Navigate, Link, useLocation, useNavigate } from "react-router-dom";
import Wall from "./pages/Wall.jsx"; import TimeMachine from "./pages/TimeMachine.jsx"; import Skin from "./pages/Skin.jsx"; import Messages from "./pages/Messages.jsx"; import Login from "./pages/Login.jsx";
import DashboardLayout from "./pages/dashboard/DashboardLayout.jsx"; import MyStories from "./pages/dashboard/MyStories.jsx"; import StoryEditor from "./pages/dashboard/StoryEditor.jsx";
import Capsule from "./pages/dashboard/Capsule.jsx"; import DashboardSkin from "./pages/dashboard/DashboardSkin.jsx"; import Settings from "./pages/dashboard/Settings.jsx";
import RequireAuth from "./auth/RequireAuth.jsx"; import { useAuth } from "./auth/AuthContext.jsx";

const TITLES = [["/dashboard", "Your space"], ["/login", "Sign in"], ["/skin-without-shame", "Skin Without Shame"], ["/time-machine", "Time Machine"], ["/messages", "Supportive Messages"], ["/", "The Living Wall"]];
const NAV = [["/", "The Living Wall"], ["/skin-without-shame", "Skin Without Shame"], ["/time-machine", "Time Machine"], ["/messages", "Supportive Messages"]];

function NotFound() { return <section className="page wall-paper"><div className="intro"><h1>We couldn't find that page</h1><p>It may have moved. The Living Wall is a good place to start again.</p><Link className="btn" to="/">Back to the Living Wall</Link></div></section>; }

function PublicTimeMachine() {
  const { loading, user } = useAuth();
  if (loading) return <section className="page wall-paper"><p role="status" className="demo">Checking your session…</p></section>;
  if (user) return <Navigate to="/dashboard/time-machine" replace />;
  return <TimeMachine />;
}

export default function App() {
  const { pathname } = useLocation(), nav = useNavigate(), { user, configured, signOut } = useAuth();
  useEffect(() => { const t = TITLES.find(([p]) => p === "/" ? pathname === "/" : pathname.startsWith(p)); document.title = `ILLUMINATE | ${t ? t[1] : "Beyond the Reflection"}`; window.scrollTo(0, 0); }, [pathname]);
  return (<>
    <a className="skip" href="#main">Skip to content</a>
    <header className="nav"><NavLink to="/" className="wordmark" aria-label="ILLUMINATE, Beyond the Reflection"><b>ILLUMINATE</b><i>Beyond the Reflection</i></NavLink>
      <nav aria-label="Main">{NAV.map(([p, l]) => <NavLink key={p} to={p} end={p === "/"}>{l}</NavLink>)}
        {user ? <><NavLink to="/dashboard">My space</NavLink><button className="link navbtn" onClick={async () => { await signOut(); nav("/"); }}>Log out</button></>
          : configured ? <NavLink to="/login" className="signin">Sign in</NavLink> : null}</nav></header>
    <main id="main"><Routes>
      <Route path="/" element={<Wall />} />
      <Route path="/living-wall" element={<Navigate to="/" replace />} />
      <Route path="/skin-without-shame" element={<Skin />} />
      <Route path="/time-machine" element={<PublicTimeMachine />} />
      <Route path="/messages" element={<Messages />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
        <Route index element={<Navigate to="stories" replace />} />
        <Route path="stories" element={<MyStories />} /><Route path="stories/new" element={<StoryEditor />} /><Route path="stories/:id" element={<StoryEditor />} />
        <Route path="time-machine" element={<Capsule />} /><Route path="skin" element={<DashboardSkin />} /><Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes></main>
    <footer className="foot">ILLUMINATE · Beyond the Reflection. Sample stories and community statistics are illustrative prototype content. Published member stories are public, with an anonymous publishing option. Drafts, letters and voluntarily saved skin results are private to your account. Photos are processed through YouCam and are not stored by Illuminate.</footer>
  </>);
}
