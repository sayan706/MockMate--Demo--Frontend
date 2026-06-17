import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Video, VideoOff } from 'lucide-react';

export default function WebcamFeed({ onFrameCapture, isActive, onCameraReady }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Dragging state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    
    setPosition({ 
      x: e.clientX - dragStartRef.current.x, 
      y: e.clientY - dragStartRef.current.y 
    });
  };

  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Start webcam
  useEffect(() => {
    if (!isActive) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraReady(true);
        if (onCameraReady) onCameraReady(true);
        setCameraError(null);
      } catch (err) {
        console.error('Camera access denied:', err);
        setCameraError('Camera access denied. Please allow camera to proceed.');
        setCameraReady(false);
        if (onCameraReady) onCameraReady(false);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  // Capture frames every 30 seconds
  useEffect(() => {
    if (!cameraReady || !onFrameCapture) return;

    const captureFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 240;
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const frameData = canvas.toDataURL('image/jpeg', 0.6);
      onFrameCapture(frameData);
    };

    // Capture first frame after 5 seconds
    const initialTimeout = setTimeout(captureFrame, 5000);
    // Then every 30 seconds
    intervalRef.current = setInterval(captureFrame, 30000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [cameraReady, onFrameCapture]);

  // Detect camera being turned off mid-interview
  useEffect(() => {
    if (!streamRef.current) return;

    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const handleTrackEnded = () => {
      setCameraReady(false);
      if (onCameraReady) onCameraReady(false);
      setCameraError('Camera was disconnected. Please reconnect your camera.');
    };

    videoTrack.addEventListener('ended', handleTrackEnded);
    return () => videoTrack.removeEventListener('ended', handleTrackEnded);
  }, [cameraReady]);

  if (!isActive) return null;

  return (
    <>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <div 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: isDragging 
          ? '0 16px 40px rgba(0,0,0,0.6), 0 0 0 2px rgba(99,102,241,0.5)' 
          : '0 8px 32px rgba(0,0,0,0.5), 0 0 0 2px rgba(99,102,241,0.3)',
        background: '#000',
        width: '200px',
        height: '150px',
        transition: isDragging ? 'none' : 'box-shadow 0.3s ease',
        transform: `translate(${position.x}px, ${position.y}px)`,
        cursor: isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}>
        {/* Live indicator */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(8px)',
          padding: '4px 10px',
          borderRadius: '20px',
          zIndex: 2,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: cameraReady ? '#ef4444' : '#666',
            animation: cameraReady ? 'livePulse 1.5s infinite' : 'none',
          }} />
          <span style={{ color: cameraReady ? '#fff' : '#888' }}>
            {cameraReady ? 'LIVE' : 'OFF'}
          </span>
        </div>

        {/* Camera icon when error */}
        {cameraError ? (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px',
          }}>
            <VideoOff size={28} color="#ef4444" />
            <span style={{ fontSize: '0.65rem', color: '#ef4444', textAlign: 'center', lineHeight: 1.3 }}>
              {cameraError}
            </span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)', // Mirror effect
            }}
          />
        )}

        {/* Glow border animation */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          border: `2px solid ${cameraReady ? 'rgba(99,102,241,0.4)' : 'rgba(239,68,68,0.4)'}`,
          pointerEvents: 'none',
          animation: cameraReady ? 'webcamGlow 3s ease-in-out infinite' : 'none',
        }} />
      </div>
    </>
  );
}
