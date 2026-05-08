/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { TopBar } from './components/ui/TopBar';
import { DebugPanel } from './components/ui/DebugPanel';
import Home from './pages/Home';
import Speaking from './pages/Speaking';
import SpeakingPractice from './pages/SpeakingPractice';
import SpeakingMock from './pages/SpeakingMock';
import Writing from './pages/Writing';
import WritingTask2Practice from './pages/WritingTask2Practice';
import WritingTask2Mock from './pages/WritingTask2Mock';
import WritingTask1Placeholder from './pages/WritingTask1Placeholder';
import Progress from './pages/Progress';
import SpeechTest from './pages/SpeechTest';
import PracticeHistory from './pages/PracticeHistory';

export default function App() {
  return (
    <AppProvider>
      <Router>
        <div className="min-h-screen bg-paper-100 selection:bg-accent-terracotta/20">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/speaking" element={<Speaking />} />
            <Route path="/speaking/practice" element={<SpeakingPractice />} />
            <Route path="/speaking/mock" element={<SpeakingMock />} />
            <Route path="/writing" element={<Writing />} />
            <Route path="/writing/task2/practice" element={<WritingTask2Practice />} />
            <Route path="/writing/task2/mock" element={<WritingTask2Mock />} />
            <Route path="/writing/task1" element={<WritingTask1Placeholder />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/practice-history" element={<PracticeHistory />} />
            <Route path="/speech-test" element={<SpeechTest />} />
          </Routes>
          <DebugPanel />
        </div>
      </Router>
    </AppProvider>
  );
}
