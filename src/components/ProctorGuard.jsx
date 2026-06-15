import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ShieldAlert, Eye, EyeOff, Clipboard, Monitor } from 'lucide-react';

export default function ProctorGuard({ isActive, onAutoTerminate }) {
  const [warnings, setWarnings] = useState([]);
  const [warningCount, setWarningCount] = useState(0);
  const [showFinalWarning, setShowFinalWarning] = useState(false);
  const warningCountRef = useRef(0);
  const lastBlurTime = useRef(0);
  const toastTimeoutRef = useRef(null);

  const MAX_WARNINGS = 5;
  const FINAL_WARNING_AT = 3;

  const addWarning = useCallback((type, message) => {
    const newCount = warningCountRef.current + 1;
    warningCountRef.current = newCount;
    setWarningCount(newCount);

    const warning = {
      id: Date.now(),
      type,
      message,
      count: newCount,
      timestamp: new Date().toLocaleTimeString(),
    };

    setWarnings(prev => [...prev.slice(-4), warning]); // Keep last 5

    // Auto-remove toast after 5 seconds
    setTimeout(() => {
      setWarnings(prev => prev.filter(w => w.id !== warning.id));
    }, 5000);

    // Show final warning
    if (newCount === FINAL_WARNING_AT) {
      setShowFinalWarning(true);
      setTimeout(() => setShowFinalWarning(false), 6000);
    }

    // Auto-terminate
    if (newCount >= MAX_WARNINGS) {
      onAutoTerminate?.('Maximum violations reached. Interview terminated due to malpractice.');
    }
  }, [onAutoTerminate]);

  useEffect(() => {
    if (!isActive) return;

    // --- Tab Visibility Change Detection ---
    const handleVisibilityChange = () => {
      if (document.hidden) {
        addWarning('tab_switch', 'Tab switch detected! Stay on the interview tab.');
      }
    };

    // --- Window Blur Detection (catches Alt+Tab, extension popups, etc.) ---
    const handleWindowBlur = () => {
      const now = Date.now();
      // Debounce: ignore rapid blur events within 1 second
      if (now - lastBlurTime.current < 1000) return;
      lastBlurTime.current = now;

      // Only warn if the tab is NOT hidden (visibility change handles that)
      if (!document.hidden) {
        addWarning('window_blur', 'Window lost focus! Possible external tool usage detected.');
      }
    };

    // --- Clipboard Paste Detection ---
    const handlePaste = (e) => {
      // Allow paste in textarea but warn
      addWarning('clipboard', 'Paste detected! Using external content is flagged.');
    };

    // --- Right-click context menu (possible copy attempt) ---
    const handleContextMenu = (e) => {
      e.preventDefault();
      addWarning('context_menu', 'Right-click disabled during interview.');
    };

    // --- Keyboard shortcut detection ---
    const handleKeyDown = (e) => {
      // Detect common cheat shortcuts
      const isCopy = (e.ctrlKey || e.metaKey) && e.key === 'c';
      const isPaste = (e.ctrlKey || e.metaKey) && e.key === 'v';
      const isDevTools = e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'i'));
      const isNewTab = (e.ctrlKey || e.metaKey) && e.key === 't';

      if (isDevTools) {
        e.preventDefault();
        addWarning('devtools', 'Developer tools shortcut detected!');
      }
      if (isNewTab) {
        e.preventDefault();
        addWarning('new_tab', 'Opening new tab is not allowed during interview!');
      }
    };

    // --- Extension/AI Tool Detection ---
    const detectAITools = () => {
      // Check for common AI assistant overlays in DOM
      const suspiciousSelectors = [
        '[data-grammarly]',
        '#grammarly-extension-root',
        '.parakeet',
        '[class*="parakeet"]',
        '[id*="parakeet"]',
        '[class*="copilot"]',
        '[data-extension]',
        '#chatgpt-sidebar',
        '[class*="ai-assist"]',
      ];

      for (const selector of suspiciousSelectors) {
        try {
          const el = document.querySelector(selector);
          if (el) {
            addWarning('ai_tool', `AI assistance tool detected (${selector.replace(/[\[\]#.*]/g, '')}). Using AI tools is not allowed.`);
            break;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
    };

    // Register all listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    // Check for AI tools every 10 seconds
    const aiCheckInterval = setInterval(detectAITools, 10000);
    detectAITools(); // Initial check

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      clearInterval(aiCheckInterval);
    };
  }, [isActive, addWarning]);

  if (!isActive) return null;

  const getWarningIcon = (type) => {
    switch (type) {
      case 'tab_switch': return <Monitor size={16} />;
      case 'window_blur': return <EyeOff size={16} />;
      case 'clipboard': return <Clipboard size={16} />;
      case 'ai_tool': return <ShieldAlert size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const getWarningColor = (count) => {
    if (count >= FINAL_WARNING_AT) return '#ef4444'; // Red
    if (count >= 2) return '#f59e0b'; // Amber
    return '#f97316'; // Orange
  };

  return (
    <>
      {/* Warning Counter Badge */}
      {warningCount > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            position: 'fixed',
            top: '16px',
            left: '16px',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${getWarningColor(warningCount)}40`,
            padding: '8px 16px',
            borderRadius: '12px',
          }}
        >
          <ShieldAlert size={18} color={getWarningColor(warningCount)} />
          <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600 }}>
            Warnings: <span style={{ color: getWarningColor(warningCount) }}>{warningCount}/{MAX_WARNINGS}</span>
          </span>
        </motion.div>
      )}

      {/* Warning Toasts */}
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxWidth: '360px',
      }}>
        <AnimatePresence>
          {warnings.map((warning) => (
            <motion.div
              key={warning.id}
              initial={{ opacity: 0, x: 100, scale: 0.8 }}
              animate={{ 
                opacity: 1, x: 0, scale: 1,
                transition: { type: 'spring', stiffness: 300, damping: 25 }
              }}
              exit={{ opacity: 0, x: 100, scale: 0.8 }}
              style={{
                background: 'rgba(20, 20, 25, 0.95)',
                backdropFilter: 'blur(16px)',
                border: `1px solid ${getWarningColor(warning.count)}60`,
                borderLeft: `3px solid ${getWarningColor(warning.count)}`,
                borderRadius: '12px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                boxShadow: `0 4px 20px rgba(0,0,0,0.4), 0 0 15px ${getWarningColor(warning.count)}20`,
                animation: 'warningShake 0.5s ease-out',
              }}
            >
              <div style={{ 
                color: getWarningColor(warning.count), 
                marginTop: '2px',
                flexShrink: 0 
              }}>
                {getWarningIcon(warning.type)}
              </div>
              <div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: getWarningColor(warning.count),
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '2px'
                }}>
                  Warning #{warning.count}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e0e0e0', lineHeight: 1.4 }}>
                  {warning.message}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Final Warning Overlay */}
      <AnimatePresence>
        {showFinalWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 3000,
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(8px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              style={{
                background: 'rgba(20,20,25,0.95)',
                border: '2px solid #ef4444',
                borderRadius: '24px',
                padding: '3rem',
                textAlign: 'center',
                maxWidth: '500px',
                boxShadow: '0 0 60px rgba(239,68,68,0.3)',
              }}
            >
              <ShieldAlert size={64} color="#ef4444" style={{ marginBottom: '1rem' }} />
              <h2 style={{ color: '#ef4444', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                FINAL WARNING
              </h2>
              <p style={{ color: '#ccc', fontSize: '1rem', lineHeight: 1.6 }}>
                You have {MAX_WARNINGS - warningCount} warning(s) remaining. 
                Further violations will result in <strong style={{ color: '#ef4444' }}>automatic interview termination</strong>.
              </p>
              <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '1rem' }}>
                This warning will dismiss automatically...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
