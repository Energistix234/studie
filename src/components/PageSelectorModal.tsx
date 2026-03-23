import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckSquare, Square, FileText, Loader2 } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PageSelectorModalProps {
  file: File;
  onConfirm: (selectedPages: number[]) => void;
  onCancel: () => void;
}

export default function PageSelectorModal({ file, onConfirm, onCancel }: PageSelectorModalProps) {
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [rangeInput, setRangeInput] = useState('');
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const pdfDocRef = useRef<any>(null);

  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  const isPptx = file.name.toLowerCase().endsWith('.pptx');

  // Load PDF pages
  useEffect(() => {
    if (isPdf) {
      loadPdf();
    } else if (isPptx) {
      loadPptxPreview();
    }

    return () => {
      // Cleanup PDF doc
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, [file]);

  const loadPdf = async () => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setPageCount(pdf.numPages);

      // Select all pages by default
      const allPages = new Set(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
      setSelectedPages(allPages);

      // Render thumbnails
      const thumbs = new Map<number, string>();
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbs.set(i, canvas.toDataURL());
        // Update progressively
        setThumbnails(new Map(thumbs));
      }
      setLoading(false);
    } catch (err) {
      console.error('Error loading PDF:', err);
      setLoading(false);
    }
  };

  const loadPptxPreview = async () => {
    try {
      const formData = new FormData();
      formData.append('document', file);
      const res = await fetch('/api/document-preview', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setPageCount(data.pageCount);
      setSlideImages(data.slideImages || []);

      // Select all slides by default
      const allPages = new Set(Array.from({ length: data.pageCount }, (_, i) => i + 1));
      setSelectedPages(allPages);
      setLoading(false);
    } catch (err) {
      console.error('Error loading PPTX preview:', err);
      setLoading(false);
    }
  };

  const togglePage = (page: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(page)) {
        next.delete(page);
      } else {
        next.add(page);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPages(new Set(Array.from({ length: pageCount }, (_, i) => i + 1)));
  };

  const deselectAll = () => {
    setSelectedPages(new Set());
  };

  const parseRange = useCallback((input: string) => {
    const pages = new Set<number>();
    const parts = input.split(',').map(p => p.trim());
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(pageCount, end); i++) {
            pages.add(i);
          }
        }
      } else {
        const num = Number(part);
        if (!isNaN(num) && num >= 1 && num <= pageCount) {
          pages.add(num);
        }
      }
    }
    return pages;
  }, [pageCount]);

  const applyRange = () => {
    if (rangeInput.trim()) {
      setSelectedPages(parseRange(rangeInput));
    }
  };

  const handleConfirm = () => {
    const sorted = Array.from(selectedPages).sort((a, b) => a - b);
    onConfirm(sorted);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-zinc-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Select Pages</h3>
                <p className="text-sm text-zinc-500">{file.name}</p>
              </div>
            </div>
            <button onClick={onCancel} className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-zinc-500" />
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-100 bg-zinc-50/50">
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <CheckSquare className="w-4 h-4" /> Select All
            </button>
            <button
              onClick={deselectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 rounded-lg transition-colors"
            >
              <Square className="w-4 h-4" /> Deselect All
            </button>

            <div className="h-5 w-px bg-zinc-300" />

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="e.g. 1-5, 8, 12-15"
                value={rangeInput}
                onChange={e => setRangeInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyRange()}
                className="px-3 py-1.5 border border-zinc-300 rounded-lg text-sm w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={applyRange}
                className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>

            <div className="ml-auto">
              <span className="text-sm font-medium text-zinc-600 bg-zinc-200/60 px-3 py-1 rounded-full">
                {selectedPages.size} / {pageCount} selected
              </span>
            </div>
          </div>

          {/* Page Grid */}
          <div className="flex-1 overflow-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-zinc-600 font-medium">Loading pages...</p>
                {isPdf && thumbnails.size > 0 && (
                  <p className="text-sm text-zinc-400 mt-1">
                    Rendered {thumbnails.size} of {pageCount || '?'} pages
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map(page => {
                  const isSelected = selectedPages.has(page);
                  const thumbnail = isPdf ? thumbnails.get(page) : slideImages[page - 1];

                  return (
                    <button
                      key={page}
                      onClick={() => togglePage(page)}
                      className={`relative group rounded-xl border-2 overflow-hidden transition-all aspect-[3/4] flex items-center justify-center bg-zinc-100 ${
                        isSelected
                          ? 'border-indigo-500 shadow-md shadow-indigo-100'
                          : 'border-zinc-200 opacity-60 hover:opacity-80 hover:border-zinc-300'
                      }`}
                    >
                      {thumbnail ? (
                        <img
                          src={thumbnail}
                          alt={`Page ${page}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-zinc-400 text-sm font-medium">Page {page}</span>
                      )}

                      {/* Page number badge */}
                      <span
                        className={`absolute top-1.5 left-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-zinc-200 text-zinc-600'
                        }`}
                      >
                        {page}
                      </span>

                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5">
                          <CheckSquare className="w-5 h-5 text-indigo-600 bg-white rounded" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-zinc-200 bg-zinc-50/50">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedPages.size === 0}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              Generate Cards from {selectedPages.size} Page{selectedPages.size !== 1 ? 's' : ''}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
