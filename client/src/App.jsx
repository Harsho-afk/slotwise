import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { NavBar } from "./components/NavBar";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { Booking } from "./pages/Booking";
import { MyAppointments } from "./pages/MyAppointments";
import { MockCheckout } from "./pages/MockCheckout";
import { AdminDashboard } from "./pages/AdminDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route
            path="/"
            element={
              <ProtectedRoute roles={["patient"]}>
                <Booking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/appointments"
            element={
              <ProtectedRoute roles={["patient"]}>
                <MyAppointments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkout/:orderId"
            element={
              <ProtectedRoute roles={["patient"]}>
                <MockCheckout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin", "doctor"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
