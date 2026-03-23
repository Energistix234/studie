import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, Save, X, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CardData {
  id: string;
  deck_id: string;
  type: string;
  front: string;
  back: string;
  image_url?: string;
  options?: string;
  masks?: any[];
}

export default function DeckView() {
  const { deckId } = useParams<{ deckId: string }>();
  const [deck, setDeck] = useState<any>(null);
  const [cards, setCards] = useState<CardData[]>([]);
  const [editingCard, setEditingCard] = useState<CardData | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Edit form state
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editOptions, setEditOptions] = useState<{ text: string; correct: boolean }[]>([]);

  useEffect(() => {
    fetchDeck();
    fetchCards();
  }, [deckId]);

  const fetchDeck = async () => {
    const res = await fetch('/api/decks');
    const decks = await res.json();
    const found = decks.find((d: any) => d.id === deckId);
    setDeck(found);
  };

  const fetchCards = async () => {
    if (!deckId) return;
    const res = await fetch(`/api/decks/${deckId}/cards`);
    const data = await res.json();
    setCards(data);
  };

  const startEdit = (card: CardData) => {
    setEditingCard(card);
    setEditFront(card.front || '');
    setEditBack(card.back || '');
    if (card.type === 'multiple_choice' && card.options) {
      try {
        const opts = typeof card.options === 'string' ? JSON.parse(card.options) : card.options;
        setEditOptions(opts);
      } catch {
        setEditOptions([]);
      }
    } else {
      setEditOptions([]);
    }
  };

  const saveEdit = async () => {
    if (!editingCard) return;
    await fetch(`/api/cards/${editingCard.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        front: editFront,
        back: editBack,
        type: editingCard.type,
        options: editingCard.type === 'multiple_choice' ? editOptions : undefined,
      })
    });
    setEditingCard(null);
    fetchCards();
  };

  const deleteCard = async (cardId: string) => {
    await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
    setDeleteConfirmId(null);
    fetchCards();
  };

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = {
      qa: 'Q&A', cloze: 'Cloze', open: 'Open',
      multiple_choice: 'MC', image_occlusion: 'Image'
    };
    return labels[type] || type;
  };

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      qa: 'bg-indigo-100 text-indigo-700',
      cloze: 'bg-purple-100 text-purple-700',
      open: 'bg-amber-100 text-amber-700',
      multiple_choice: 'bg-emerald-100 text-emerald-700',
      image_occlusion: 'bg-cyan-100 text-cyan-700',
    };
    return colors[type] || 'bg-zinc-100 text-zinc-700';
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/" className="p-2 hover:bg-zinc-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-zinc-500" />
        </Link>
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">{deck?.name || 'Deck'}</h2>
          <p className="text-zinc-500 mt-1">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/add" className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Cards
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-400 text-lg font-medium mb-4">No cards in this deck yet.</p>
          <Link to="/add" className="text-indigo-600 font-medium hover:underline">Add some cards</Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {cards.map(card => (
            <div
              key={card.id}
              className="bg-white rounded-xl border border-zinc-200 p-5 shadow-sm hover:shadow-md transition-shadow relative"
            >
              <div className="flex items-start gap-4">
                {/* Type badge */}
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 mt-0.5 ${typeColor(card.type)}`}>
                  {typeLabel(card.type)}
                </span>

                {/* Card content */}
                <div className="flex-1 min-w-0">
                  {card.type === 'image_occlusion' && card.image_url ? (
                    <div className="w-24 h-16 rounded-lg overflow-hidden border border-zinc-100 bg-zinc-50">
                      <img src={card.image_url} alt="Card" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <>
                      <p className="font-medium text-zinc-900 line-clamp-2">{card.front}</p>
                      {card.back && (
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-1">{card.back}</p>
                      )}
                      {card.type === 'multiple_choice' && card.options && (
                        <div className="flex gap-1 mt-2">
                          {(() => {
                            try {
                              const opts = typeof card.options === 'string' ? JSON.parse(card.options) : card.options;
                              return opts.map((opt: any, idx: number) => (
                                <span key={idx} className={`text-xs px-1.5 py-0.5 rounded ${opt.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
                                  {String.fromCharCode(65 + idx)}
                                </span>
                              ));
                            } catch { return null; }
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(card)}
                    className="p-2 hover:bg-zinc-100 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(card.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-500" />
                  </button>
                </div>
              </div>

              {/* Delete confirmation */}
              {deleteConfirmId === card.id && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl flex items-center justify-center gap-3 z-10">
                  <p className="text-sm font-medium text-zinc-700">Delete this card?</p>
                  <button onClick={() => setDeleteConfirmId(null)} className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg">Cancel</button>
                  <button onClick={() => deleteCard(card.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditingCard(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-zinc-900">Edit Card</h3>
                <button onClick={() => setEditingCard(null)} className="p-1.5 hover:bg-zinc-100 rounded-lg">
                  <X className="w-5 h-5 text-zinc-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Front</label>
                  <textarea
                    value={editFront}
                    onChange={(e) => setEditFront(e.target.value)}
                    className="w-full h-24 p-3 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-zinc-700 mb-1 block">Back</label>
                  <textarea
                    value={editBack}
                    onChange={(e) => setEditBack(e.target.value)}
                    className="w-full h-24 p-3 border border-zinc-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                </div>

                {editingCard.type === 'multiple_choice' && (
                  <div>
                    <label className="text-sm font-medium text-zinc-700 mb-2 block">Options</label>
                    <div className="space-y-2">
                      {editOptions.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <button
                            onClick={() => setEditOptions(opts => opts.map((o, i) => ({ ...o, correct: i === idx })))}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                              opt.correct ? 'bg-emerald-500 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                            }`}
                          >
                            {String.fromCharCode(65 + idx)}
                          </button>
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => setEditOptions(opts => opts.map((o, i) => i === idx ? { ...o, text: e.target.value } : o))}
                            className="flex-1 px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">Click a letter to mark as correct answer.</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEditingCard(null)} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-xl">
                  Cancel
                </button>
                <button onClick={saveEdit} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
