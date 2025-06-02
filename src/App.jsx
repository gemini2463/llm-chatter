import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import Chatter from "./Chatter.jsx";

const Shared = lazy(() => import("./Shared.jsx"));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Chatter />} />
          <Route path="/shared/:userName/:uniqueId" element={<Shared />} />
          <Route path="*" element={<Chatter />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
