import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, Send, LogOut, CheckCircle2, Camera, Award, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import WebcamFeed from './WebcamFeed';
import ProctorGuard from './ProctorGuard';
import { API_BASE_URL } from '../config';

export default function InterviewSession({ interview, cvText, onEnd }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]); // { role: 'ai' | 'user', text: string, type: 'question' | 'report' | 'answer' }
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true); // initially true while waiting for first question
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const baseTranscriptRef = useRef('');
  const transcriptRef = useRef('');
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);

  // Keep ref synced for use in closures
  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Auto-scroll to bottom of chat only when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea as text grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '60px'; // Reset first
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(60, Math.min(scrollHeight, 300)) + 'px';
    }
  }, [transcript]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let lastProcessedIndex = -1;

      recognition.onresult = (event) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            // Only append final results once to prevent duplication
            if (i > lastProcessedIndex) {
              const base = baseTranscriptRef.current.trim();
              const piece = event.results[i][0].transcript.trim();
              baseTranscriptRef.current = base + (base && piece ? ' ' : '') + piece;
              lastProcessedIndex = i;
            }
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const base = baseTranscriptRef.current.trim();
        const interim = interimTranscript.trim();
        const separator = base && interim ? ' ' : '';
        
        setTranscript(base + separator + interim);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        baseTranscriptRef.current = transcriptRef.current;
        lastProcessedIndex = -1; // Reset for next session
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API not supported in this browser.");
    }
  }, []);

  // Text-to-Speech via ElevenLabs proxy
  const speakElevenLabs = async (text) => {
    try {
      // Cancel any ongoing speech
      if (sourceNodeRef.current) {
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      }

      setIsSpeaking(true);

      const response = await fetch(`${API_BASE_URL}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text,
          voice_gender: interview.voice_gender || 'male'
        })
      });

      if (!response.ok) {
        console.error("ElevenLabs TTS failed, falling back to browser TTS", response.status);
        fallbackBrowserSpeak(text);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }

      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      sourceNodeRef.current = source;

      source.onended = () => {
        setIsSpeaking(false);
      };

      source.start(0);
    } catch (err) {
      console.error("Error playing audio via ElevenLabs:", err);
      fallbackBrowserSpeak(text);
    }
  };

  const fallbackBrowserSpeak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Select an English voice for the fallback
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  };

  // Socket Connection
  useEffect(() => {
    if (!isCameraReady) return; // Wait for camera permission

    const newSocket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      // Start the interview, sending CV text if available
      newSocket.emit('start_interview', { 
        interview_id: interview.id,
        cv_text: cvText 
      });
    });

    newSocket.on('question', (data) => {
      console.log('Received question:', data);
      setIsProcessing(false);
      setMessages(prev => [...prev, { role: 'ai', text: data.clean_text, type: 'question' }]);
      speakElevenLabs(data.clean_text);
    });

    newSocket.on('report', (data) => {
      console.log('Received report:', data);
      setIsProcessing(false);
      setReportData(data);
      speakElevenLabs(data.spoken_remarks || "The interview has concluded. Here is your evaluation report.");
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      setIsProcessing(false);
      alert('Error: ' + err.message);
    });

    setSocket(newSocket);

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (sourceNodeRef.current) sourceNodeRef.current.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
      newSocket.disconnect();
    };
  }, [interview.id, cvText, isCameraReady]);

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      baseTranscriptRef.current = transcriptRef.current;
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleSendAnswer = () => {
    if (!transcript.trim()) return;
    
    const answer = transcript.trim();
    setMessages(prev => [...prev, { role: 'user', text: answer, type: 'answer' }]);
    
    // Stop listening if it was
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    setTranscript('');
    baseTranscriptRef.current = '';
    transcriptRef.current = '';
    setIsProcessing(true);
    socket.emit('answer', { answer });
  };

  // Handle manual typing as fallback
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAnswer();
    }
  };

  return (
    <>
      <ProctorGuard 
        isActive={true} 
        onAutoTerminate={(reason) => {
          alert(reason);
          onEnd();
        }} 
      />
      
      <WebcamFeed 
        isActive={true} 
        onCameraReady={(ready) => setIsCameraReady(ready)}
        onFrameCapture={(frameData) => {
          if (socket && !isProcessing) {
            socket.emit('receive_frame', { frame_data: frameData });
          }
        }} 
      />

      {/* Camera Permission Overlay */}
      {!isCameraReady && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500, // WebcamFeed is 1000, so it stays on top
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="glass-panel"
            style={{
              padding: '3rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.5rem',
              maxWidth: '450px',
              textAlign: 'center',
              background: 'rgba(20,20,30,0.8)',
              border: '1px solid rgba(99,102,241,0.3)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)',
              borderRadius: '24px'
            }}
          >
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(99,102,241,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 0 30px rgba(99,102,241,0.2)'
            }}>
              <Camera size={40} color="#818cf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '0.8rem', color: '#fff', fontWeight: 600 }}>Camera Access Required</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '1rem' }}>
                Your browser is currently waiting for camera permissions. Please allow access to begin your mock interview session.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Final Report Overlay */}
      {reportData && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2000, // Highest so it's above everything including WebcamFeed
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            overflowY: 'auto'
          }}
        >
          <motion.div 
            initial={{ scale: 0.9, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: 'linear-gradient(145deg, rgba(30,30,40,0.9) 0%, rgba(20,20,30,0.9) 100%)',
              border: '1px solid rgba(99,102,241,0.4)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 40px rgba(99,102,241,0.2)',
              borderRadius: '24px',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '2rem',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: 'rgba(99,102,241,0.1)'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 20px rgba(99,102,241,0.3)'
              }}>
                <Award size={32} color="#818cf8" />
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  Interview Summary <Sparkles size={24} color="#f59e0b" />
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0', fontSize: '1.1rem' }}>
                  Here is your detailed feedback and evaluation.
                </p>
              </div>
            </div>

            {/* Content */}
            <div style={{
              padding: '2.5rem',
              overflowY: 'auto',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              lineHeight: 1.8,
              whiteSpace: 'pre-wrap',
            }}>
              {reportData.clean_text}
            </div>

            {/* Footer Action */}
            <div style={{
              padding: '1.5rem 2rem',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'rgba(0,0,0,0.2)'
            }}>
              <button 
                onClick={onEnd}
                className="glass-button"
                style={{
                  background: 'var(--accent-primary)',
                  color: 'white',
                  padding: '12px 32px',
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)'
                }}
              >
                Return to Dashboard <LogOut size={18} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        
        {/* Header */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{interview.name}</h2>
          </div>
          <button 
            className="glass-button" 
            onClick={onEnd}
            style={{ background: 'var(--bg-secondary)', padding: '8px 16px', fontSize: '0.9rem' }}
          >
            <LogOut size={16} /> Quit
          </button>
        </div>

        {/* Chat Area */}
        <div className="glass-panel" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {messages.map((msg, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                background: msg.role === 'user' ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : 'var(--radius-md)',
                borderBottomLeftRadius: msg.role === 'ai' ? '4px' : 'var(--radius-md)',
                border: '1px solid var(--border-glass)',
                boxShadow: msg.role === 'user' ? '0 4px 15px rgba(99, 102, 241, 0.2)' : 'none',
                whiteSpace: 'pre-wrap'
              }}
            >
              {msg.type === 'report' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--success)' }}>
                  <CheckCircle2 size={20} />
                  <strong style={{ color: 'var(--text-primary)' }}>Final Report</strong>
                </div>
              )}
              {msg.text}
            </motion.div>
          ))}

          {isProcessing && (
            <div style={{ alignSelf: 'flex-start', padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>AI is thinking</span>
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="glass-panel" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <button 
              onClick={toggleListen}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: 'none',
                background: isListening ? 'var(--error)' : 'var(--bg-secondary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s',
                boxShadow: isListening ? '0 0 15px rgba(239, 68, 68, 0.5)' : 'none',
                animation: isListening ? 'pulseGlow 2s infinite' : 'none',
                flexShrink: 0
              }}
              disabled={isProcessing}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={transcript}
                onChange={(e) => {
                  setTranscript(e.target.value);
                  baseTranscriptRef.current = e.target.value;
                }}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Listening..." : "Click mic to speak, or type your answer..."}
                disabled={isProcessing}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  padding: '1rem',
                  fontFamily: 'inherit',
                  fontSize: '1rem',
                  resize: 'none',
                  minHeight: '60px',
                  maxHeight: '300px',
                  outline: 'none',
                  overflowY: 'auto',
                  lineHeight: '1.5'
                }}
              />
            </div>

            <button 
              onClick={handleSendAnswer}
              disabled={!transcript.trim() || isProcessing}
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                border: 'none',
                background: (!transcript.trim() || isProcessing) ? 'var(--bg-secondary)' : 'var(--accent-primary)',
                color: (!transcript.trim() || isProcessing) ? 'var(--text-secondary)' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: (!transcript.trim() || isProcessing) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s',
                flexShrink: 0
              }}
            >
              <Send size={20} style={{ marginLeft: '4px' }} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
