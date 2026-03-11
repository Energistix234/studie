/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LayoutDashboard, PlusCircle, BookOpen, Settings } from 'lucide-react';
import Dashboard from './components/Dashboard';
import AddCard from './components/AddCard';
import Study from './components/Study';
import DeckView from './components/DeckView';

export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-zinc-50 text-zinc-900 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col">
          <div className="p-6">
            <h1 className="text-2xl font-bold tracking-tight text-indigo-600 flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              NeuroDeck
            </h1>
            <p className="text-sm text-zinc-500 mt-1">AI-Powered Flashcards</p>
          </div>
          
          <nav className="flex-1 px-4 space-y-1">
            <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium transition-colors">
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </Link>
            <Link to="/add" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium transition-colors">
              <PlusCircle className="w-5 h-5" />
              Add Cards
            </Link>
            <Link to="/study" className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium transition-colors">
              <BookOpen className="w-5 h-5" />
              Study
            </Link>
          </nav>
          
          <div className="p-4 border-t border-zinc-200">
            <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg hover:bg-zinc-100 text-zinc-700 font-medium transition-colors">
              <Settings className="w-5 h-5" />
              Settings
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-zinc-50/50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<AddCard />} />
            <Route path="/study" element={<Study />} />
            <Route path="/deck/:deckId" element={<DeckView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

