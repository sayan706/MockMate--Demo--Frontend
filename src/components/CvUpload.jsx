import React, { useState, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { Upload, File, FileText, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CvUpload({ onUploadSuccess, onSkip, canSkip = false }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);
    setSuccessData(null);
    
    if (!selectedFile) return;
    
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.pdf') && !selectedFile.name.endsWith('.docx')) {
      setError('Please upload a PDF or DOCX file.');
      return;
    }
    
    if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
      setError('File is too large. Maximum size is 5MB.');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10); // Start progress
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      const response = await axios.post(`${API_BASE_URL}/api/upload-cv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        setIsUploading(false);
        setSuccessData(response.data);
        if (onUploadSuccess) {
          // Pass the cv_text to parent after a brief delay to show success state
          setTimeout(() => onUploadSuccess(response.data.cv_text), 1500);
        }
      }, 500);

    } catch (err) {
      setIsUploading(false);
      setUploadProgress(0);
      setError(err.response?.data?.error || 'Failed to upload CV. Please try again.');
    }
  };

  const resetUpload = () => {
    setFile(null);
    setError(null);
    setSuccessData(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Upload Your CV</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          We'll analyze your resume to ask personalized questions during the interview.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!successData ? (
          <motion.div
            key="upload-area"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--accent-primary)' : 'var(--border-glass)'}`,
                background: isDragging ? 'rgba(99,102,241,0.05)' : 'rgba(0,0,0,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                cursor: isUploading ? 'default' : 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf,.docx"
                style={{ display: 'none' }}
                disabled={isUploading}
              />

              {!file ? (
                <>
                  <div style={{
                    width: '60px', height: '60px',
                    borderRadius: '50%',
                    background: 'var(--bg-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-primary)'
                  }}>
                    <Upload size={28} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontWeight: 500, marginBottom: '4px' }}>Click or drag file to this area to upload</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Supports PDF or DOCX (Max 5MB)</p>
                  </div>
                </>
              ) : (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-sm)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                      <FileText size={24} color="var(--accent-primary)" />
                      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                    {!isUploading && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  {isUploading && (
                    <div style={{ width: '100%', height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ 
                        height: '100%', background: 'var(--accent-primary)', width: `${uploadProgress}%`,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && (
              <div style={{ 
                marginTop: '1rem', padding: '12px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', fontSize: '0.9rem'
              }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              {canSkip && (
                <button 
                  className="glass-button" 
                  onClick={onSkip}
                  style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                  disabled={isUploading}
                >
                  Skip
                </button>
              )}
              <button 
                className="glass-button" 
                onClick={handleUpload}
                disabled={!file || isUploading}
                style={{ flex: 2 }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Analyzing...
                  </>
                ) : (
                  'Proceed with CV'
                )}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="success-area"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: '2rem',
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              textAlign: 'center'
            }}
          >
            <div style={{ 
              width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981'
            }}>
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981', marginBottom: '4px' }}>CV Analyzed Successfully</h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Extracted {successData.char_count} characters. Ready to start your personalized interview.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
