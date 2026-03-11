import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayCircle, Check, X, HelpCircle, BrainCircuit } from 'lucide-react';

export default function Study() {
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [cards, setCards] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isStudying, setIsStudying] = useState(false);

  useEffect(() => {
    fetch('/api/decks')
      .then(res => res.json())
      .then(data => {
        setDecks(data);
        if (data.length > 0) setSelectedDeck(data[0].id);
      });
  }, []);

  const startStudy = async () => {
    if (!selectedDeck) return;
    const res = await fetch(`/api/decks/${selectedDeck}/cards`);
    const data = await res.json();
    setCards(data);
    setCurrentCardIndex(0);
    setShowAnswer(false);
    setIsStudying(true);
  };

  const handleRating = (rating: 'again' | 'hard' | 'good' | 'easy') => {
    // In a real app, this would update the FSRS algorithm in the backend
    // For now, just move to the next card
    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setIsStudying(false);
      alert('Deck finished!');
    }
  };

  if (!isStudying) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
          <BrainCircuit className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-bold text-zinc-900 tracking-tight mb-2">Ready to Study?</h2>
        <p className="text-zinc-500 mb-8 text-center max-w-md">Select a deck to begin your spaced repetition session powered by FSRS.</p>
        
        <div className="w-full max-w-md bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col gap-4">
          <label className="text-sm font-medium text-zinc-700">Choose Deck</label>
          <select 
            className="w-full px-4 py-3 border border-zinc-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-zinc-50"
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
          >
            {decks.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          
          <button 
            onClick={startStudy}
            disabled={!selectedDeck || decks.length === 0}
            className="w-full mt-4 bg-zinc-900 text-white py-3 rounded-xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <PlayCircle className="w-5 h-5" /> Start Session
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];

  if (!currentCard) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
        <h2 className="text-2xl font-bold text-zinc-900 mb-4">No cards in this deck.</h2>
        <button onClick={() => setIsStudying(false)} className="text-indigo-600 font-medium hover:underline">Go back</button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center min-h-[80vh]">
      <div className="w-full flex justify-between items-center mb-8">
        <button onClick={() => setIsStudying(false)} className="text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
          Exit Study
        </button>
        <div className="text-sm font-medium text-zinc-500 bg-zinc-200/50 px-3 py-1 rounded-full">
          {currentCardIndex + 1} / {cards.length}
        </div>
      </div>

      <div className="w-full max-w-2xl flex-1 flex flex-col">
        {/* Card Container */}
        <div className="flex-1 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col relative">
          
          {/* Front */}
          <div className="p-8 md:p-12 flex-1 flex flex-col items-center justify-center text-center">
            {currentCard.type === 'qa' && (
              <h3 className="text-2xl md:text-3xl font-medium text-zinc-900 leading-relaxed">
                {currentCard.front}
              </h3>
            )}
            
            {currentCard.type === 'cloze' && (
              <h3 className="text-2xl md:text-3xl font-medium text-zinc-900 leading-relaxed">
                {showAnswer ? (
                  <span dangerouslySetInnerHTML={{ __html: currentCard.front.replace(/{{c1::(.*?)}}/g, '<span class="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-md">$1</span>') }} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: currentCard.front.replace(/{{c1::(.*?)}}/g, '<span class="text-zinc-400 font-bold bg-zinc-100 px-4 py-1 rounded-md border-b-2 border-zinc-300">[...]</span>') }} />
                )}
              </h3>
            )}

            {currentCard.type === 'image_occlusion' && (
              <div className="relative w-full max-w-full flex justify-center items-center">
                <img src={currentCard.image_url} alt="Occlusion" className="max-w-full max-h-[50vh] object-contain rounded-lg" />
                {currentCard.masks?.map((mask: any) => (
                  <div
                    key={mask.id}
                    className={`absolute transition-all ${showAnswer ? 'bg-transparent border-2 border-indigo-500' : 'bg-indigo-500'}`}
                    style={{
                      left: `${mask.x}%`,
                      top: `${mask.y}%`,
                      width: `${mask.width}%`,
                      height: `${mask.height}%`,
                    }}
                  >
                    {showAnswer && <span className="absolute -top-6 left-0 bg-indigo-600 text-white text-xs px-2 py-1 rounded shadow-sm whitespace-nowrap">{mask.text}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          {showAnswer && currentCard.type === 'qa' && (
            <div className="w-full h-px bg-zinc-100 relative">
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-4 text-xs font-bold tracking-widest text-zinc-400 uppercase">Answer</div>
            </div>
          )}

          {/* Back */}
          <AnimatePresence>
            {showAnswer && currentCard.type === 'qa' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-8 md:p-12 flex-1 flex flex-col items-center justify-center text-center bg-zinc-50/50"
              >
                <p className="text-xl md:text-2xl text-zinc-700 leading-relaxed">
                  {currentCard.back}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="mt-8 h-20 flex items-center justify-center">
          {!showAnswer ? (
            <button 
              onClick={() => setShowAnswer(true)}
              className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-semibold text-lg hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md active:scale-95 w-full max-w-xs"
            >
              Show Answer
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 w-full"
            >
              <button onClick={() => handleRating('again')} className="flex-1 py-4 bg-red-50 text-red-700 rounded-2xl font-semibold hover:bg-red-100 transition-colors border border-red-200">
                <div className="text-sm opacity-70 mb-1">Again</div>
                <div className="text-lg">&lt; 1m</div>
              </button>
              <button onClick={() => handleRating('hard')} className="flex-1 py-4 bg-orange-50 text-orange-700 rounded-2xl font-semibold hover:bg-orange-100 transition-colors border border-orange-200">
                <div className="text-sm opacity-70 mb-1">Hard</div>
                <div className="text-lg">6m</div>
              </button>
              <button onClick={() => handleRating('good')} className="flex-1 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-semibold hover:bg-emerald-100 transition-colors border border-emerald-200">
                <div className="text-sm opacity-70 mb-1">Good</div>
                <div className="text-lg">10m</div>
              </button>
              <button onClick={() => handleRating('easy')} className="flex-1 py-4 bg-blue-50 text-blue-700 rounded-2xl font-semibold hover:bg-blue-100 transition-colors border border-blue-200">
                <div className="text-sm opacity-70 mb-1">Easy</div>
                <div className="text-lg">4d</div>
              </button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
