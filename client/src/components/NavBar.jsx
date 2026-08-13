import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <header
      style={{
        borderBottom: "1px solid var(--line)",
        background: "#fff",
      }}
    >
      <div
        className="shell"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.5rem",
          maxWidth: 880,
        }}
      >
        <Link to="/" style={{ textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "1.15rem",
              color: "var(--sage-deep)",
            }}
          >
            Clinic
          </span>
        </Link>

        <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {user?.role === "patient" && (
            <>
              <Link to="/">Book</Link>
              <Link to="/appointments">My appointments</Link>
            </>
          )}
          {(user?.role === "admin" || user?.role === "doctor") && (
            <Link to="/admin">Dashboard</Link>
          )}
          {user ? (
            <>
              <span className="eyebrow">{user.fullName}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/signup" className="btn btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
