import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayCircle, BrainCircuit, Send } from 'lucide-react';

export default function Study() {
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [cards, setCards] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isStudying, setIsStudying] = useState(false);

  // Open question state
  const [openAnswer, setOpenAnswer] = useState('');

  // Multiple choice state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

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
    setOpenAnswer('');
    setSelectedOption(null);
    setIsStudying(true);
  };

  const currentCard = cards[currentCardIndex];

  // Parse and shuffle MC options once per card
  const shuffledOptions = useMemo(() => {
    if (!currentCard || currentCard.type !== 'multiple_choice') return [];
    try {
      const opts = typeof currentCard.options === 'string'
        ? JSON.parse(currentCard.options)
        : currentCard.options;
      if (!Array.isArray(opts)) return [];
      // Shuffle using Fisher-Yates
      const shuffled = [...opts];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    } catch {
      return [];
    }
  }, [currentCard?.id]);

  const handleRating = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
    // Persist review
    if (currentCard) {
      try {
        await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: currentCard.id, rating }),
        });
      } catch (err) {
        console.error('Failed to save review:', err);
      }
    }

    if (currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setShowAnswer(false);
      setOpenAnswer('');
      setSelectedOption(null);
    } else {
      setIsStudying(false);
      alert('Deck finished!');
    }
  };

  const handleOpenSubmit = () => {
    setShowAnswer(true);
  };

  const handleMCSelect = (index: number) => {
    if (selectedOption !== null) return; // Already selected
    setSelectedOption(index);
    setShowAnswer(true);
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

  if (!currentCard) {
    return (
      <div className="p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[80vh]">
        <h2 className="text-2xl font-bold text-zinc-900 mb-4">No cards in this deck.</h2>
        <button onClick={() => setIsStudying(false)} className="text-indigo-600 font-medium hover:underline">Go back</button>
      </div>
    );
  }

  const cardTypeBadge = () => {
    const labels: Record<string, string> = { qa: 'Q&A', cloze: 'Cloze', open: 'Open', multiple_choice: 'Multiple Choice', image_occlusion: 'Image' };
    return (
      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">
        {labels[currentCard.type] || currentCard.type}
      </span>
    );
  };

  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col items-center min-h-[80vh]">
      <div className="w-full flex justify-between items-center mb-8">
        <button onClick={() => setIsStudying(false)} className="text-zinc-500 hover:text-zinc-900 font-medium transition-colors">
          Exit Study
        </button>
        <div className="flex items-center gap-3">
          {cardTypeBadge()}
          <div className="text-sm font-medium text-zinc-500 bg-zinc-200/50 px-3 py-1 rounded-full">
            {currentCardIndex + 1} / {cards.length}
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl flex-1 flex flex-col">
        {/* Card Container */}
        <div className="flex-1 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col relative">

          {/* Front */}
          <div className="p-8 md:p-12 flex-1 flex flex-col items-center justify-center text-center">
            {/* Q&A */}
            {currentCard.type === 'qa' && (
              <h3 className="text-2xl md:text-3xl font-medium text-zinc-900 leading-relaxed">
                {currentCard.front}
              </h3>
            )}

            {/* Cloze */}
            {currentCard.type === 'cloze' && (
              <h3 className="text-2xl md:text-3xl font-medium text-zinc-900 leading-relaxed">
                {showAnswer ? (
                  <span dangerouslySetInnerHTML={{ __html: currentCard.front.replace(/\{\{c1::(.*?)\}\}/g, '<span class="text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-md">$1</span>') }} />
                ) : (
                  <span dangerouslySetInnerHTML={{ __html: currentCard.front.replace(/\{\{c1::(.*?)\}\}/g, '<span class="text-zinc-400 font-bold bg-zinc-100 px-4 py-1 rounded-md border-b-2 border-zinc-300">[...]</span>') }} />
                )}
              </h3>
            )}

            {/* Image Occlusion */}
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

            {/* Open Question */}
            {currentCard.type === 'open' && (
              <div className="w-full text-left">
                <h3 className="text-2xl md:text-3xl font-medium text-zinc-900 leading-relaxed text-center mb-6">
                  {currentCard.front}
                </h3>
                {!showAnswer && (
                  <div className="mt-4">
                    <textarea
                      className="w-full h-32 p-4 border border-zinc-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      placeholder="Type your answer here..."
                      value={openAnswer}
                      onChange={(e) => setOpenAnswer(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Multiple Choice */}
            {currentCard.type === 'multiple_choice' && (
              <div className="w-full">
                <h3 className="text-2xl md:text-3xl font-medium text-zinc-900 leading-relaxed text-center mb-8">
                  {currentCard.front}
                </h3>
                <div className="grid grid-cols-1 gap-3 w-full">
                  {shuffledOptions.map((opt: any, idx: number) => {
                    const letter = String.fromCharCode(65 + idx);
                    let optionClasses = 'w-full text-left p-4 rounded-xl border-2 font-medium transition-all ';

                    if (selectedOption === null) {
                      // Not yet answered
                      optionClasses += 'border-zinc-200 hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer';
                    } else if (opt.correct) {
                      // This is the correct answer
                      optionClasses += 'border-emerald-500 bg-emerald-50 text-emerald-800';
                    } else if (selectedOption === idx && !opt.correct) {
                      // User selected this wrong answer
                      optionClasses += 'border-red-500 bg-red-50 text-red-800';
                    } else {
                      // Other non-selected, non-correct options
                      optionClasses += 'border-zinc-200 opacity-50';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleMCSelect(idx)}
                        disabled={selectedOption !== null}
                        className={optionClasses}
                      >
                        <span className="inline-flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                            selectedOption !== null && opt.correct ? 'bg-emerald-500 text-white' :
                            selectedOption === idx && !opt.correct ? 'bg-red-500 text-white' :
                            'bg-zinc-100 text-zinc-600'
                          }`}>
                            {letter}
                          </span>
                          {opt.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Divider + Answer for Q&A */}
          {showAnswer && currentCard.type === 'qa' && (
            <div className="w-full h-px bg-zinc-100 relative">
              <div className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-4 text-xs font-bold tracking-widest text-zinc-400 uppercase">Answer</div>
            </div>
          )}

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

          {/* Open Question Answer Comparison */}
          <AnimatePresence>
            {showAnswer && currentCard.type === 'open' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="border-t border-zinc-100"
              >
                <div className="grid grid-cols-2 divide-x divide-zinc-100">
                  <div className="p-6">
                    <div className="text-xs font-bold tracking-widest text-zinc-400 uppercase mb-3">Your Answer</div>
                    <p className="text-base text-zinc-700 leading-relaxed whitespace-pre-wrap">
                      {openAnswer || <span className="italic text-zinc-400">No answer provided</span>}
                    </p>
                  </div>
                  <div className="p-6 bg-emerald-50/30">
                    <div className="text-xs font-bold tracking-widest text-emerald-600 uppercase mb-3">Model Answer</div>
                    <p className="text-base text-zinc-700 leading-relaxed">
                      {currentCard.back}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="mt-8 min-h-[5rem] flex items-center justify-center">
          {!showAnswer ? (
            <>
              {/* Open question: Submit Answer button */}
              {currentCard.type === 'open' ? (
                <button
                  onClick={handleOpenSubmit}
                  className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-semibold text-lg hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md active:scale-95 w-full max-w-xs flex items-center justify-center gap-2"
                >
                  <Send className="w-5 h-5" /> Submit Answer
                </button>
              ) : currentCard.type === 'multiple_choice' ? (
                <p className="text-zinc-400 font-medium">Select an option above</p>
              ) : (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-semibold text-lg hover:bg-zinc-800 transition-all shadow-sm hover:shadow-md active:scale-95 w-full max-w-xs"
                >
                  Show Answer
                </button>
              )}
            </>
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
