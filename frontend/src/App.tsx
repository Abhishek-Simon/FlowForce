import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';

import Dashboard from './pages/Dashboard';
import LiveMonitoring from './pages/LiveMonitoring';
import CamerasPage from './pages/CamerasPage';
import VideoAnalysis from './pages/VideoAnalysis';
import AnalyticsPage from './pages/AnalyticsPage';
import PredictionsPage from './pages/PredictionsPage';
import EmergencyCenter from './pages/EmergencyCenter';
import AlertsPage from './pages/AlertsPage';
import SignalPage from './pages/SignalPage';
import SafetyAnalyticsPage from './pages/SafetyAnalyticsPage';
import IntersectionMatrix from './pages/IntersectionMatrix';
import SystemHealth from './pages/SystemHealth';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-[#090d16] text-slate-900 dark:text-slate-200 transition-colors duration-150">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Topbar alertCount={1} />
            <main className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-50 dark:bg-[#090d16]">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/matrix" element={<IntersectionMatrix />} />
                <Route path="/monitoring" element={<LiveMonitoring />} />
                <Route path="/cameras" element={<CamerasPage />} />
                <Route path="/video-analysis" element={<VideoAnalysis />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/predictions" element={<PredictionsPage />} />
                <Route path="/emergency" element={<EmergencyCenter />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/signals" element={<SignalPage />} />
                <Route path="/safety" element={<SafetyAnalyticsPage />} />
                <Route path="/incidents" element={<AlertsPage />} />
                <Route path="/system" element={<SystemHealth />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
