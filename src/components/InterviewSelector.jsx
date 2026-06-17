import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { Play, ChevronDown, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CvUpload from "./CvUpload";

export default function InterviewSelector({ onSelect }) {
  const [interviews, setInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [showCvUpload, setShowCvUpload] = useState(false);

  useEffect(() => {
    // Fetch interviews from backend
    axios
      .get(`${API_BASE_URL}/api/interviews`)
      .then((res) => {
        setInterviews(res.data);
        if (res.data.length > 0) {
          setSelectedId(res.data[0].id);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch interviews", err);
        setLoading(false);
      });
  }, []);

  const handleStartClick = () => {
    const selected = interviews.find((i) => i.id === selectedId);
    if (!selected) return;

    if (selected.requires_cv) {
      setShowCvUpload(true);
    } else {
      handleFinalStart(selected, null);
    }
  };

  const handleFinalStart = (selected, cvText) => {
    // Pre-warm speech synthesis engine
    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(u);
    }
    onSelect(selected, cvText);
  };

  const selectedItem = interviews.find((i) => i.id === selectedId);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        zIndex: 10,
      }}
    >
      <div
        className="glass-panel fade-in"
        style={{
          padding: "2rem",
          width: "100%",
          maxWidth: "500px",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
          animationDelay: "0.2s",
        }}
      >
        <h2
          style={{ textAlign: "center", fontSize: "1.5rem", fontWeight: 600 }}
        >
          Select Interview
        </h2>

        {loading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: "2rem",
            }}
          >
            <Loader2
              className="animate-spin"
              style={{ animation: "spin 1s linear infinite" }}
            />
          </div>
        ) : (
          <>
            {!showCvUpload ? (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.5rem",
                }}
              >
                <div style={{ position: "relative" }}>
                  <div
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border-glass)",
                      padding: "1rem",
                      borderRadius: "var(--radius-sm)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "all 0.3s",
                    }}
                  >
                    <span>
                      {selectedItem ? selectedItem.name : "Select an interview"}
                    </span>
                    <ChevronDown
                      size={20}
                      style={{
                        transform: isOpen ? "rotate(180deg)" : "none",
                        transition: "0.3s",
                      }}
                    />
                  </div>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          width: "100%",
                          background: "var(--bg-glass)",
                          backdropFilter: "blur(16px)",
                          border: "1px solid var(--border-glass)",
                          borderRadius: "var(--radius-sm)",
                          marginTop: "0.5rem",
                          zIndex: 20,
                          overflow: "hidden",
                        }}
                      >
                        {interviews.map((interview) => (
                          <div
                            key={interview.id}
                            onClick={() => {
                              setSelectedId(interview.id);
                              setIsOpen(false);
                            }}
                            style={{
                              padding: "1rem",
                              cursor: "pointer",
                              background:
                                selectedId === interview.id
                                  ? "var(--bg-secondary)"
                                  : "transparent",
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--bg-secondary)")
                            }
                            onMouseLeave={(e) => {
                              if (selectedId !== interview.id) {
                                e.currentTarget.style.background =
                                  "transparent";
                              }
                            }}
                          >
                            <div style={{ fontWeight: 500 }}>
                              {interview.name}
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  className="glass-button"
                  onClick={handleStartClick}
                  disabled={!selectedId}
                  style={{ width: "100%", padding: "1rem" }}
                >
                  {selectedItem?.requires_cv ? (
                    "Next: Upload CV"
                  ) : (
                    <>
                      <Play size={20} /> Start Session
                    </>
                  )}
                </button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1rem",
                }}
              >
                <button
                  onClick={() => setShowCvUpload(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    alignSelf: "flex-start",
                    padding: "0 0 10px 0",
                  }}
                >
                  <ArrowLeft size={16} /> Back to Selection
                </button>
                <CvUpload
                  onUploadSuccess={(cvText) =>
                    handleFinalStart(selectedItem, cvText)
                  }
                  onSkip={() => handleFinalStart(selectedItem, null)}
                  canSkip={true}
                />
              </motion.div>
            )}
          </>
        )}
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `,
        }}
      />
    </div>
  );
}
