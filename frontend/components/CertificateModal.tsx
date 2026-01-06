'use client';

import { useEffect, useState } from 'react';

interface CertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  certificateUrl: string;
  athleteName: string;
}

export default function CertificateModal({
  isOpen,
  onClose,
  certificateUrl,
  athleteName,
}: CertificateModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState<Array<{ id: number; left: number; delay: number; duration: number }>>([]);

  useEffect(() => {
    if (!isOpen) {
      setShowConfetti(false);
      setConfettiPieces([]);
    }
  }, [isOpen]);

  const handleDownload = () => {
    // Trigger confetti animation
    setShowConfetti(true);
    const pieces = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 1 + Math.random() * 1,
    }));
    setConfettiPieces(pieces);

    // Download the certificate - opens file save dialog
    const link = document.createElement('a');
    link.href = certificateUrl;
    link.download = `certificate-${athleteName.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Reset confetti after animation
    setTimeout(() => {
      setShowConfetti(false);
      setConfettiPieces([]);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      {/* Confetti Container */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {confettiPieces.map((piece) => {
            const colors = ['#FFD700', '#FF0E65', '#2563EB', '#10B981', '#F59E0B'];
            const colorIndex = piece.id % colors.length;
            const rotation = (piece.id * 37) % 360;
            return (
              <div
                key={piece.id}
                className="absolute w-3 h-3 animate-confetti"
                style={{
                  left: `${piece.left}%`,
                  top: '-20px',
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.duration}s`,
                  background: colors[colorIndex],
                  transform: `rotate(${rotation}deg)`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Modal Container */}
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2563EB] to-[#1d4ed8] px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-wider">
              🎉 Congratulations!
            </h2>
            <p className="text-sm text-blue-100 mt-1">{athleteName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-red-300 transition-colors duration-200 text-2xl font-bold w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        {/* PDF Preview */}
        <div className="bg-gray-50 p-6 max-h-[60vh] overflow-auto">
          <div className="bg-white rounded-lg shadow-inner p-2">
            <iframe
              src={`${certificateUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-[500px] rounded border-2 border-gray-200"
              title="Certificate Preview"
            />
          </div>
        </div>

        {/* Footer with Download Button */}
        <div className="bg-white px-6 py-4 border-t-2 border-gray-100 flex justify-center gap-4">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-3 px-8 py-3 bg-gradient-to-r from-yellow-400 to-yellow-600 hover:from-yellow-500 hover:to-yellow-700 text-white font-black rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl uppercase tracking-wider text-sm"
          >
            <span className="text-xl">🎉</span>
            <span>Download Certificate</span>
            <span className="text-lg">⬇️</span>
          </button>
        </div>
      </div>

      {/* Global Styles for Animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes confetti {
          0% {
            transform: translateY(-20px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }

        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }

        .animate-confetti {
          animation: confetti 2s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}
