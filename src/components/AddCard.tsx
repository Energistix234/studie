import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { FileImage, FileText, UploadCloud, Loader2, Save, Trash2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import PageSelectorModal from './PageSelectorModal';

export default function AddCard() {
  const [activeTab, setActiveTab] = useState<'text' | 'image' | 'document'>('image');
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');

  // Image Occlusion State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [detectedMasks, setDetectedMasks] = useState<any[]>([]);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  // Text Generation State
  const [inputText, setInputText] = useState('');
  const [isGeneratingText, setIsGeneratingText] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<any[]>([]);

  // Document Upload State
  const [isProcessingDocument, setIsProcessingDocument] = useState(false);
  const [documentImages, setDocumentImages] = useState<string[]>([]);
  const [documentCards, setDocumentCards] = useState<any[]>([]);

  // Page Selector State
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPageSelector, setShowPageSelector] = useState(false);

  useEffect(() => {
    fetch('/api/decks')
      .then(res => res.json())
      .then(data => {
        setDecks(data);
        if (data.length > 0) setSelectedDeck(data[0].id);
      });
  }, []);

  const handleDocumentUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.toLowerCase();
    if (ext.endsWith('.pdf') || ext.endsWith('.pptx')) {
      // Show page selector modal for PDF and PPTX
      setPendingFile(file);
      setShowPageSelector(true);
    } else {
      // For DOCX or other files, process immediately (no page selection)
      processDocument(file, null);
    }
  };

  const handlePageSelection = async (selectedPages: number[]) => {
    setShowPageSelector(false);
    if (pendingFile) {
      processDocument(pendingFile, selectedPages);
      setPendingFile(null);
    }
  };

  const handlePageSelectorCancel = () => {
    setShowPageSelector(false);
    setPendingFile(null);
  };

  const processDocument = async (file: File, selectedPages: number[] | null) => {
    setIsProcessingDocument(true);
    setDocumentImages([]);
    setDocumentCards([]);

    try {
      const formData = new FormData();
      formData.append('document', file);
      if (selectedPages) {
        formData.append('pages', JSON.stringify(selectedPages));
      }
      const res = await fetch('/api/upload-document', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.generatedCards) {
        setDocumentCards(data.generatedCards.map((c: any, i: number) => ({ ...c, id: i.toString(), selected: true })));
      }
      if (data.images) {
        setDocumentImages(data.images);
      }

      if ((!data.generatedCards || data.generatedCards.length === 0) && (!data.images || data.images.length === 0)) {
        alert('No text or images could be extracted from this document, or the text was too short to generate flashcards.');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to process document.');
    } finally {
      setIsProcessingDocument(false);
    }
  };

  const processDocumentImage = async (imgUrl: string) => {
    setActiveTab('image');
    setImageUrl(imgUrl);
    setIsProcessingImage(true);
    setDetectedMasks([]);

    try {
      // Fetch the image as a blob to convert to base64
      const response = await fetch(imgUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        if (!base64Data) return;

        const prompt = `
          Analyze this image and find all significant text elements, labels, and pointers.
          Return a JSON array of objects. Each object should represent a text element found in the image.
          Format:
          [
            {
              "text": "The detected text",
              "box": [ymin, xmin, ymax, xmax] // normalized coordinates between 0 and 1000
            }
          ]
          Only return the JSON array, no other text.
        `;

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const aiResponse = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: blob.type || 'image/jpeg'
                  }
                },
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: 'application/json'
            }
          });

          const text = aiResponse.text || '[]';
          const detectedText = JSON.parse(text);

          const masks = detectedText.map((item: any, index: number) => {
            const [ymin, xmin, ymax, xmax] = item.box;
            return {
              id: index.toString(),
              text: item.text,
              x: (xmin / 1000) * 100,
              y: (ymin / 1000) * 100,
              width: ((xmax - xmin) / 1000) * 100,
              height: ((ymax - ymin) / 1000) * 100,
              active: true
            };
          });
          setDetectedMasks(masks);
        } catch (err) {
          console.error('Failed to analyze image with Gemini:', err);
          alert('Failed to analyze image. Please check your API key.');
        } finally {
          setIsProcessingImage(false);
        }
      };
    } catch (error) {
      console.error('Error fetching image for analysis:', error);
      setIsProcessingImage(false);
    }
  };

  const saveDocumentCards = async () => {
    if (!selectedDeck) return;

    const selectedCards = documentCards.filter(c => c.selected);

    for (const card of selectedCards) {
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck_id: selectedDeck,
          type: card.type,
          front: card.front,
          back: card.back,
          options: card.options || undefined,
        })
      });
    }

    alert(`${selectedCards.length} cards saved!`);
    setDocumentCards([]);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setImageUrl(localUrl);
    setIsProcessingImage(true);
    setDetectedMasks([]);

    try {
      // 1. Upload to backend to get a permanent URL
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      const serverImageUrl = data.imageUrl;
      setImageUrl(serverImageUrl); // Update to server URL

      // 2. Call Gemini API directly from frontend
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1];
        if (!base64Data) return;

        const prompt = `
          Analyze this image and find all significant text elements, labels, and pointers.
          Return a JSON array of objects. Each object should represent a text element found in the image.
          Format:
          [
            {
              "text": "The detected text",
              "box": [ymin, xmin, ymax, xmax] // normalized coordinates between 0 and 1000
            }
          ]
          Only return the JSON array, no other text.
        `;

        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: {
              parts: [
                {
                  inlineData: {
                    data: base64Data,
                    mimeType: file.type
                  }
                },
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: 'application/json'
            }
          });

          const text = response.text || '[]';
          const detectedText = JSON.parse(text);

          const masks = detectedText.map((item: any, index: number) => {
            const [ymin, xmin, ymax, xmax] = item.box;
            return {
              id: index.toString(),
              text: item.text,
              x: (xmin / 1000) * 100,
              y: (ymin / 1000) * 100,
              width: ((xmax - xmin) / 1000) * 100,
              height: ((ymax - ymin) / 1000) * 100,
              active: true
            };
          });
          setDetectedMasks(masks);
        } catch (err) {
          console.error('Failed to analyze image with Gemini:', err);
          alert('Failed to analyze image. Please check your API key.');
        } finally {
          setIsProcessingImage(false);
        }
      };
    } catch (error) {
      console.error('Error uploading image:', error);
      setIsProcessingImage(false);
    }
  };

  const toggleMask = (id: string) => {
    setDetectedMasks(masks => 
      masks.map(m => m.id === id ? { ...m, active: !m.active } : m)
    );
  };

  const saveImageOcclusionCard = async () => {
    if (!selectedDeck || !imageUrl || detectedMasks.filter(m => m.active).length === 0) return;

    const activeMasks = detectedMasks.filter(m => m.active);
    
    await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deck_id: selectedDeck,
        type: 'image_occlusion',
        image_url: imageUrl,
        masks: activeMasks
      })
    });

    alert('Image Occlusion Card Saved!');
    setImageFile(null);
    setImageUrl(null);
    setDetectedMasks([]);
  };

  const handleGenerateText = async () => {
    if (!inputText.trim()) return;
    setIsGeneratingText(true);
    
    try {
      const prompt = `
        Based on the following text, generate 5 high-quality flashcards.
        Include a mix of card types:
        - "qa": Standard question/answer
        - "cloze": Fill-in-the-blank using {{c1::hidden text}} format
        - "open": Open-ended question requiring a written response (front=question, back=model answer)
        - "multiple_choice": Question with 4 options. Include "options" array: [{"text": "...", "correct": true/false}]. Exactly one correct.

        Return a JSON array of objects with: type, front, back, and optionally options (for multiple_choice only).

        Text:
        ${inputText}
      `;

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const cards = JSON.parse(response.text || '[]');
      if (cards) {
        setGeneratedCards(cards.map((c: any, i: number) => ({ ...c, id: i.toString(), selected: true })));
      }
    } catch (error) {
      console.error('Error generating cards:', error);
      alert('Failed to generate cards. Please check your API key.');
    } finally {
      setIsGeneratingText(false);
    }
  };

  const saveGeneratedCards = async () => {
    if (!selectedDeck) return;

    const selectedCards = generatedCards.filter(c => c.selected);

    for (const card of selectedCards) {
      await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deck_id: selectedDeck,
          type: card.type,
          front: card.front,
          back: card.back,
          options: card.options || undefined,
        })
      });
    }

    alert(`${selectedCards.length} cards saved!`);
    setGeneratedCards([]);
    setInputText('');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Add Flashcards</h2>
          <p className="text-zinc-500 mt-2">Create cards manually or use AI to generate them.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-zinc-200 shadow-sm">
          <label className="text-sm font-medium text-zinc-700">Target Deck:</label>
          <select 
            className="bg-transparent text-sm font-semibold text-indigo-600 focus:outline-none"
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
          >
            {decks.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-zinc-200/50 p-1 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('image')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'image' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
        >
          <FileImage className="w-4 h-4" /> Image Occlusion
        </button>
        <button 
          onClick={() => setActiveTab('text')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'text' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
        >
          <FileText className="w-4 h-4" /> Text to Cards
        </button>
        <button 
          onClick={() => setActiveTab('document')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'document' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
        >
          <UploadCloud className="w-4 h-4" /> Document
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'document' && (
          <motion.div 
            key="document"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6"
          >
            {documentCards.length === 0 && documentImages.length === 0 && !isProcessingDocument ? (
              <div className="border-2 border-dashed border-zinc-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-zinc-50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept=".pdf,.pptx,.docx" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleDocumentUpload}
                />
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">Upload PDF or PPTX</h3>
                <p className="text-sm text-zinc-500 max-w-sm">Drag and drop a document, or click to browse. AI will extract text and images to generate flashcards.</p>
              </div>
            ) : isProcessingDocument ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                <p className="text-zinc-600 font-medium">Processing document...</p>
                <p className="text-sm text-zinc-500 mt-2">Extracting text, images, and generating cards.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Generated Text Cards */}
                {documentCards.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-zinc-900">Generated Text Cards</h3>
                      <button 
                        onClick={saveDocumentCards}
                        disabled={documentCards.filter(c => c.selected).length === 0}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Save className="w-4 h-4" /> Save {documentCards.filter(c => c.selected).length} Cards
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {documentCards.map((card) => (
                        <div
                          key={card.id}
                          onClick={() => setDocumentCards(cards => cards.map(c => c.id === card.id ? { ...c, selected: !c.selected } : c))}
                          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${card.selected ? 'border-indigo-600 bg-indigo-50/30' : 'border-zinc-200 hover:border-indigo-300'}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">
                              {card.type === 'qa' ? 'Q&A' : card.type === 'cloze' ? 'Cloze' : card.type === 'open' ? 'Open' : 'MC'}
                            </span>
                            {card.selected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                          </div>
                          <p className="font-medium text-zinc-900 mt-2">{card.front}</p>
                          {card.back && <p className="text-sm text-zinc-500 mt-2 pt-2 border-t border-zinc-200/50">{card.back}</p>}
                          {card.type === 'multiple_choice' && card.options && (
                            <div className="mt-2 pt-2 border-t border-zinc-200/50 grid grid-cols-2 gap-1">
                              {(Array.isArray(card.options) ? card.options : []).map((opt: any, idx: number) => (
                                <span key={idx} className={`text-xs px-2 py-1 rounded ${opt.correct ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-zinc-100 text-zinc-600'}`}>
                                  {String.fromCharCode(65 + idx)}. {opt.text}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Extracted Images */}
                {documentImages.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 mb-4">Extracted Images</h3>
                    <p className="text-sm text-zinc-500 mb-4">Click an image to create an Image Occlusion card.</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {documentImages.map((imgUrl, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => processDocumentImage(imgUrl)}
                          className="relative aspect-video bg-zinc-100 rounded-xl border border-zinc-200 overflow-hidden cursor-pointer group hover:border-indigo-500 transition-colors"
                        >
                          <img src={imgUrl} alt={`Extracted ${idx}`} className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-sm font-medium px-3 py-1.5 bg-indigo-600 rounded-lg">Process Image</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="pt-4 border-t border-zinc-200 flex justify-end">
                  <button 
                    onClick={() => { setDocumentCards([]); setDocumentImages([]); }}
                    className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
                  >
                    Clear Document
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'image' && (
          <motion.div 
            key="image"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6"
          >
            {!imageUrl ? (
              <div className="border-2 border-dashed border-zinc-300 rounded-xl p-12 flex flex-col items-center justify-center text-center hover:bg-zinc-50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleImageUpload}
                />
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-1">Upload Diagram or Slide</h3>
                <p className="text-sm text-zinc-500 max-w-sm">Drag and drop an image, or click to browse. AI will automatically detect labels to occlude.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-zinc-900">Review Occlusions</h3>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => { setImageUrl(null); setDetectedMasks([]); }}
                      className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" /> Discard
                    </button>
                    <button 
                      onClick={saveImageOcclusionCard}
                      disabled={isProcessingImage || detectedMasks.filter(m => m.active).length === 0}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" /> Save Card
                    </button>
                  </div>
                </div>

                <div className="relative border border-zinc-200 rounded-xl overflow-hidden bg-zinc-100 flex justify-center items-center min-h-[400px]">
                  {isProcessingImage && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
                      <p className="text-sm font-medium text-zinc-700">AI is analyzing image...</p>
                    </div>
                  )}
                  
                  <div className="relative inline-block max-w-full">
                    <img 
                      ref={imageRef}
                      src={imageUrl} 
                      alt="Uploaded" 
                      className="max-w-full max-h-[600px] object-contain block"
                      onLoad={(e) => {
                        setImageDimensions({
                          width: e.currentTarget.width,
                          height: e.currentTarget.height
                        });
                      }}
                    />
                    
                    {/* Render Masks */}
                    {!isProcessingImage && detectedMasks.map((mask) => (
                      <div
                        key={mask.id}
                        onClick={() => toggleMask(mask.id)}
                        className={`absolute cursor-pointer border-2 transition-all ${mask.active ? 'bg-indigo-500/80 border-indigo-600' : 'bg-transparent border-red-500 hover:bg-red-500/20'}`}
                        style={{
                          left: `${mask.x}%`,
                          top: `${mask.y}%`,
                          width: `${mask.width}%`,
                          height: `${mask.height}%`,
                        }}
                        title={mask.text}
                      />
                    ))}
                  </div>
                </div>
                
                <div className="text-sm text-zinc-500 flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-500 rounded-sm"></div> Active Mask (will be hidden)
                  <div className="w-3 h-3 border-2 border-red-500 rounded-sm ml-4"></div> Inactive Mask (will be visible)
                  <span className="ml-auto">Click masks to toggle</span>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'text' && (
          <motion.div 
            key="text"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-6"
          >
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4">Paste Lecture Notes</h3>
              <textarea 
                className="w-full h-48 p-4 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Paste your notes, transcript, or textbook excerpt here..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
              />
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleGenerateText}
                  disabled={isGeneratingText || !inputText.trim()}
                  className="px-6 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isGeneratingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Generate Smart Cards
                </button>
              </div>
            </div>

            {generatedCards.length > 0 && (
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-semibold text-zinc-900">Review Generated Cards</h3>
                  <button 
                    onClick={saveGeneratedCards}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Selected ({generatedCards.filter(c => c.selected).length})
                  </button>
                </div>
                
                <div className="grid gap-4">
                  {generatedCards.map((card) => (
                    <div
                      key={card.id}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${card.selected ? 'border-indigo-500 bg-indigo-50/30' : 'border-zinc-200 bg-white hover:border-zinc-300'}`}
                      onClick={() => setGeneratedCards(cards => cards.map(c => c.id === card.id ? { ...c, selected: !c.selected } : c))}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">
                          {card.type === 'qa' ? 'Q&A' : card.type === 'cloze' ? 'Cloze' : card.type === 'open' ? 'Open' : card.type === 'multiple_choice' ? 'MC' : card.type}
                        </span>
                        {card.selected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                      </div>
                      <p className="font-medium text-zinc-900 mt-2">{card.front}</p>
                      {card.back && <p className="text-sm text-zinc-600 mt-2 pt-2 border-t border-zinc-200/60">{card.back}</p>}
                      {card.type === 'multiple_choice' && card.options && (
                        <div className="mt-2 pt-2 border-t border-zinc-200/50 grid grid-cols-2 gap-1">
                          {(Array.isArray(card.options) ? card.options : []).map((opt: any, idx: number) => (
                            <span key={idx} className={`text-xs px-2 py-1 rounded ${opt.correct ? 'bg-emerald-100 text-emerald-700 font-medium' : 'bg-zinc-100 text-zinc-600'}`}>
                              {String.fromCharCode(65 + idx)}. {opt.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Selector Modal */}
      {showPageSelector && pendingFile && (
        <PageSelectorModal
          file={pendingFile}
          onConfirm={handlePageSelection}
          onCancel={handlePageSelectorCancel}
        />
      )}
    </div>
  );
}
