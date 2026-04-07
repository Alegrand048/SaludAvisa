import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthSessionProvider } from "./context/AuthSessionContext";
import { AppStyleBridge } from "./components/AppStyleBridge";

export default function App() {
  return (
    <AuthSessionProvider>
      <AppStyleBridge />
      <RouterProvider router={router} />
    </AuthSessionProvider>
  );
}