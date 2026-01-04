import React, { useState } from 'react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  movieId: string;
  movieName: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, movieId, movieName }) => {
  const [includeCaptions, setIncludeCaptions] = useState(false);
  const [includePrompt, setIncludePrompt] = useState(true);
  const [includeLoop, setIncludeLoop] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate URL based on options
  const baseUrl = `${window.location.origin}/watch/${movieId}`;
  const params = new URLSearchParams();
  if (includeCaptions) params.append('captions', 'true');
  if (!includePrompt) params.append('prompt', 'false'); // Only append if false (deviating from default)
  if (includeLoop) params.append('loop', 'true');

  const shareUrl = `${baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-bat-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
            Share Movie
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-300 text-sm">
            Share <span className="text-white font-semibold">"{movieName}"</span> with others via a public link.
          </p>

          {/* Options */}
          <div className="space-y-3 bg-black/20 p-4 rounded-lg border border-gray-800">
             <h3 className="text-xs uppercase font-bold text-gray-500 mb-2">Default Viewer Options</h3>

             <label className="flex items-center gap-3 cursor-pointer group">
               <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeCaptions ? 'bg-bat-yellow border-bat-yellow text-black' : 'border-gray-600 bg-transparent'}`}>
                  {includeCaptions && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
               </div>
               <input type="checkbox" className="hidden" checked={includeCaptions} onChange={(e) => setIncludeCaptions(e.target.checked)} />
               <span className="text-gray-300 group-hover:text-white transition-colors">Start with Captions ON</span>
             </label>

             <label className="flex items-center gap-3 cursor-pointer group">
               <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includePrompt ? 'bg-bat-yellow border-bat-yellow text-black' : 'border-gray-600 bg-transparent'}`}>
                  {includePrompt && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
               </div>
               <input type="checkbox" className="hidden" checked={includePrompt} onChange={(e) => setIncludePrompt(e.target.checked)} />
               <span className="text-gray-300 group-hover:text-white transition-colors">Start with Movie Info ON</span>
             </label>

             <label className="flex items-center gap-3 cursor-pointer group">
               <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${includeLoop ? 'bg-bat-yellow border-bat-yellow text-black' : 'border-gray-600 bg-transparent'}`}>
                  {includeLoop && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
               </div>
               <input type="checkbox" className="hidden" checked={includeLoop} onChange={(e) => setIncludeLoop(e.target.checked)} />
               <span className="text-gray-300 group-hover:text-white transition-colors">Start with Loop ON</span>
             </label>
          </div>

          {/* Link Box */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Share Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-black/40 border border-gray-700 rounded-lg px-3 py-2 text-gray-300 font-mono text-sm focus:outline-none focus:border-bat-yellow/50"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 font-medium rounded-lg transition-all flex items-center gap-2 ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-bat-yellow text-black hover:bg-yellow-400'}`}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
