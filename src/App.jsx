import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Hero from './components/Hero';
import InterviewSelector from './components/InterviewSelector';
import InterviewSession from './components/InterviewSession';

function App() {
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [cvText, setCvText] = useState(null);

  const handleSelectInterview = (interview, extractedCvText = null) => {
    setSelectedInterview(interview);
    setCvText(extractedCvText);
  };

  const handleEndInterview = () => {
    setSelectedInterview(null);
    setCvText(null);
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Background decorations */}
      <div style={{
        position: 'fixed',
        top: '-20%',
        left: '-10%',
        width: '50vw',
        height: '50vw',
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 60%)',
        zIndex: -1,
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'fixed',
        bottom: '-20%',
        right: '-10%',
        width: '60vw',
        height: '60vw',
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 60%)',
        zIndex: -1,
        pointerEvents: 'none'
      }} />

      <AnimatePresence mode="wait">
        {!selectedInterview ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
            transition={{ duration: 0.5 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Hero />
            <InterviewSelector onSelect={handleSelectInterview} />
          </motion.div>
        ) : (
          <motion.div
            key="session"
            initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: window.innerWidth < 768 ? '1rem' : '2rem' }}
          >
            <InterviewSession 
              interview={selectedInterview} 
              cvText={cvText}
              onEnd={handleEndInterview} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
