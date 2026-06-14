import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InterviewSelector({ onSelect }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Fetch interviews from backend
    axios.get('https://mockmate-demo-backend.onrender.com/api/interviews')
      .then(res => {
        setInterviews(res.data);
        if (res.data.length > 0) {
          setSelectedId(res.data[0].id);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch interviews", err);
        setLoading(false);
      });
  }, []);

  const handleStart = () => {
    // Pre-warm speech synthesis engine on user click to bypass browser autoplay restrictions
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance('');
      window.speechSynthesis.speak(u);
    }

    const selected = interviews.find(i => i.id === selectedId);
    if (selected) {
      onSelect(selected);
    }
  };

  const selectedItem = interviews.find(i => i.id === selectedId);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      zIndex: 10
    }}>
      <div className="glass-panel fade-in" style={{
        padding: '2rem',
        width: '100%',
        maxWidth: '500px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        animationDelay: '0.2s'
      }}>
        <h2 style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 600 }}>Select Interview</h2>
        
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <>
            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => setIsOpen(!isOpen)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              >
                <span>{selectedItem ? selectedItem.name : 'Select an interview'}</span>
                <ChevronDown size={20} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
              </div>

              <AnimatePresence>
                {isOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      width: '100%',
                      background: 'var(--bg-glass)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: 'var(--radius-sm)',
                      marginTop: '0.5rem',
                      zIndex: 20,
                      overflow: 'hidden'
                    }}
                  >
                    {interviews.map(interview => (
                      <div 
                        key={interview.id}
                        onClick={() => {
                          setSelectedId(interview.id);
                          setIsOpen(false);
                        }}
                        style={{
                          padding: '1rem',
                          cursor: 'pointer',
                          background: selectedId === interview.id ? 'var(--bg-secondary)' : 'transparent',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                        onMouseLeave={(e) => {
                          if (selectedId !== interview.id) {
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <div style={{ fontWeight: 500 }}>{interview.name}</div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              className="glass-button" 
              onClick={handleStart}
              disabled={!selectedId}
              style={{ width: '100%', marginTop: '1rem', padding: '1rem' }}
            >
              <Play size={20} />
              Start Session
            </button>
          </>
        )}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}
