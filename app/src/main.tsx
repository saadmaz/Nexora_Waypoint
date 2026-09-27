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
import Release from './screens/Release';
import Live from './screens/Live';
import Conflict from './screens/Conflict';
import Exception from './screens/Exception';
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
        <Route path="/plan/release" element={<Release />} />
        <Route path="/live" element={<Live />} />
        <Route path="/live/conflict" element={<Conflict />} />
        <Route path="/live/exception" element={<Exception />} />
        <Route path="/screens" element={<ScreenIndex />} />
        <Route path="*" element={<Navigate to="/screens" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
