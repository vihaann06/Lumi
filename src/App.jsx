import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import UploadScreen from './components/UploadScreen';
import ReaderScreen from './components/ReaderScreen';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<UploadScreen />} />
      <Route path="/reader" element={<ReaderScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
