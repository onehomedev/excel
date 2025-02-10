import { Suspense } from "react";
import { useRoutes, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./components/landing-page";
import Home from "./components/home";
import routes from "tempo-routes";
import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <>
        {/* For the tempo routes */}
        {import.meta.env.VITE_TEMPO === "true" && useRoutes(routes)}

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/viewer" element={<Home />} />
          {import.meta.env.VITE_TEMPO === "true" && (
            <Route path="/tempobook/*" />
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <Toaster />
      </>
    </Suspense>
  );
}

export default App;
