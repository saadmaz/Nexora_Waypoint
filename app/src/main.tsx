import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-mono/700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import Queue from './screens/Queue';
import Capacity from './screens/Capacity';
import Trips from './screens/Trips';
import Deferrals from './screens/Deferrals';
import ScreenIndex from './screens/ScreenIndex';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/plan/queue" replace />} />
        <Route path="/plan/queue" element={<Queue />} />
        <Route path="/plan/capacity" element={<Capacity />} />
        <Route path="/plan/trips" element={<Trips />} />
        <Route path="/plan/deferrals" element={<Deferrals />} />
        <Route path="/deferrals" element={<Deferrals />} />
        <Route path="/screens" element={<ScreenIndex />} />
        <Route path="*" element={<Navigate to="/screens" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
