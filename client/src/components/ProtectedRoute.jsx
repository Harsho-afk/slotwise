import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Where a logged-in user lands if they hit a route their role can't use.
// Every role's home route must itself be reachable by that role, or this
// redirect would just bounce back into the same guard (e.g. an admin
// hitting "/" — which only patients can view — must NOT be sent back to
// "/", or ProtectedRoute keeps redirecting to itself forever).
function homeRouteFor(role) {
  return role === "admin" || role === "doctor" ? "/admin" : "/";
}

export function ProtectedRoute({ roles, children }) {
  const { user, ready } = useAuth();

  if (!ready) return null; // wait for the silent-refresh check to finish
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeRouteFor(user.role)} replace />;
  }

  return children;
}
