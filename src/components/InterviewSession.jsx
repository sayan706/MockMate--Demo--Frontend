import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, Send, LogOut, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function InterviewSession({ interview, onEnd }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]); // { role: 'ai' | 'user', text: string, type: 'question' | 'report' | 'answer' }
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(true); // initially true while waiting for first question
  
  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);
  const textareaRef = useRef(null);
  const baseTranscriptRef = useRef('');
  const transcriptRef = useRef('');

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

  const utteranceRef = useRef(null);

  // Text-to-Speech function
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    utteranceRef.current = new SpeechSynthesisUtterance(text);
    
    // Select an English voice if available to ensure consistent TTS
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.includes('en-US') || v.lang.includes('en-GB'));
    if (englishVoice) {
      utteranceRef.current.voice = englishVoice;
    }

    utteranceRef.current.rate = 1.0;
    utteranceRef.current.pitch = 1.0;
    
    utteranceRef.current.onstart = () => setIsSpeaking(true);
    utteranceRef.current.onend = () => setIsSpeaking(false);
    utteranceRef.current.onerror = (e) => {
      console.error("Speech error", e);
      setIsSpeaking(false);
    };
    
    // Resume in case the browser gets stuck in a paused state (common bug)
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utteranceRef.current);
  };

  // Socket Connection
  useEffect(() => {
    const newSocket = io('https://mockmate-demo-backend.onrender.com', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      // Start the interview
      newSocket.emit('start_interview', { interview_id: interview.id });
    });

    newSocket.on('question', (data) => {
      console.log('Received question:', data);
      setIsProcessing(false);
      setMessages(prev => [...prev, { role: 'ai', text: data.clean_text, type: 'question' }]);
      speak(data.clean_text);
    });

    newSocket.on('report', (data) => {
      console.log('Received report:', data);
      setIsProcessing(false);
      setMessages(prev => [...prev, { role: 'ai', text: data.clean_text, type: 'report' }]);
      speak("The interview has concluded. Here is your evaluation report.");
    });

    newSocket.on('error', (err) => {
      console.error('Socket error:', err);
      setIsProcessing(false);
      alert('Error: ' + err.message);
    });

    setSocket(newSocket);

    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
      newSocket.disconnect();
    };
  }, [interview.id]);

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
  );
}
