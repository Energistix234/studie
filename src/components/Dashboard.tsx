import { useState, useEffect, FormEvent } from 'react';
import { Layers, Plus, Play, Search, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [decks, setDecks] = useState([]);
  const [newDeckName, setNewDeckName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState('');

  useEffect(() => {
    fetchDecks();
  }, []);

  const fetchDecks = async () => {
    const res = await fetch('/api/decks');
    const data = await res.json();
    setDecks(data);
  };

  const createDeck = async (e: FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;
    
    await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newDeckName })
    });
    
    setNewDeckName('');
    fetchDecks();
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleBackfill = async () => {
    setIsBackfilling(true);
    setBackfillMessage('');
    try {
      const res = await fetch('/api/backfill-embeddings', { method: 'POST' });
      const data = await res.json();
      setBackfillMessage(data.message || data.error);
    } catch (err) {
      console.error(err);
      setBackfillMessage('Failed to backfill embeddings');
    } finally {
      setIsBackfilling(false);
      setTimeout(() => setBackfillMessage(''), 5000);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Your Decks</h2>
          <p className="text-zinc-500 mt-2">Manage your study materials and track progress.</p>
          <div className="mt-4 flex items-center gap-3">
            <button 
              onClick={handleBackfill}
              disabled={isBackfilling}
              className="px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isBackfilling ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Generate Embeddings for Existing Cards
            </button>
            {backfillMessage && <span className="text-xs text-emerald-600 font-medium">{backfillMessage}</span>}
          </div>
        </div>
        
        <form onSubmit={handleSearch} className="relative w-full md:w-96">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-zinc-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-zinc-300 rounded-xl leading-5 bg-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            placeholder="Semantic search across all cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
            </div>
          )}
        </form>
      </header>

      {searchResults.length > 0 && (
        <div className="mb-12">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-zinc-900">Search Results</h3>
            <button 
              onClick={() => { setSearchResults([]); setSearchQuery(''); }}
              className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            >
              Clear Results
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((card: any) => (
              <div key={card.id} className="bg-white p-5 rounded-xl border border-zinc-200 shadow-sm flex flex-col">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">
                    {card.type === 'qa' ? 'Q&A' : card.type === 'cloze' ? 'Cloze' : 'Image'}
                  </span>
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                    {(card.similarity * 100).toFixed(1)}% match
                  </span>
                </div>
                {card.type === 'image_occlusion' && card.image_url ? (
                  <div className="mt-2 mb-3 rounded-lg overflow-hidden border border-zinc-100 relative h-32 bg-zinc-50">
                    <img src={card.image_url} alt="Card" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <p className="font-medium text-zinc-900 mt-2 line-clamp-3">{card.front}</p>
                )}
                {card.back && card.type !== 'image_occlusion' && (
                  <p className="text-sm text-zinc-500 mt-2 pt-2 border-t border-zinc-100 line-clamp-2">{card.back}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Create Deck Card */}
        <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm flex flex-col justify-center items-center text-center min-h-[200px] hover:border-indigo-300 transition-colors group">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
            <Plus className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-zinc-900 mb-2">Create New Deck</h3>
          <form onSubmit={createDeck} className="w-full mt-2">
            <input 
              type="text" 
              placeholder="Deck Name..." 
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
            />
            <button type="submit" className="mt-2 w-full bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Create
            </button>
          </form>
        </div>

        {/* Existing Decks */}
        {decks.map((deck: any) => (
          <div key={deck.id} className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm flex flex-col min-h-[200px] hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-zinc-100 text-zinc-600 rounded-xl flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <h3 className="font-semibold text-lg text-zinc-900 mb-1">{deck.name}</h3>
            <p className="text-sm text-zinc-500 mb-auto">0 cards due today</p>
            
            <div className="mt-6 flex gap-2">
              <Link to="/study" className="flex-1 bg-zinc-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Study
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
