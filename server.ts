import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import db, { initDb } from './src/db.js';
import { GoogleGenAI, Type } from '@google/genai';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';

// Use dynamic import or require for pdf-parse to avoid ESM issues
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

let ai: GoogleGenAI | null = null;
function getAi() {
  if (!ai) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set');
    }
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return ai;
}

// Setup multer for file uploads
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  
  // Serve uploaded files
  app.use('/uploads', express.static(uploadDir));

  // Initialize DB
  initDb();

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Decks
  app.get('/api/decks', (req, res) => {
    const decks = db.prepare('SELECT * FROM decks ORDER BY created_at DESC').all();
    res.json(decks);
  });

  app.post('/api/decks', (req, res) => {
    const { name } = req.body;
    const id = uuidv4();
    db.prepare('INSERT INTO decks (id, name) VALUES (?, ?)').run(id, name);
    res.json({ id, name });
  });

  // Cards
  app.get('/api/decks/:deckId/cards', (req, res) => {
    const { deckId } = req.params;
    const cards = db.prepare('SELECT * FROM cards WHERE deck_id = ? ORDER BY created_at DESC').all(deckId);
    
    // Fetch masks for image occlusion cards
    const cardsWithMasks = cards.map((card: any) => {
      if (card.type === 'image_occlusion') {
        card.masks = db.prepare('SELECT * FROM image_masks WHERE card_id = ?').all(card.id);
      }
      return card;
    });
    
    res.json(cardsWithMasks);
  });

  app.post('/api/cards', async (req, res) => {
    const { deck_id, type, front, back, image_url, masks } = req.body;
    const id = uuidv4();
    
    let embeddingStr = null;
    try {
      const aiClient = getAi();
      // Combine text to embed
      let textToEmbed = front || '';
      if (back) textToEmbed += ' ' + back;
      if (type === 'image_occlusion' && masks) {
        textToEmbed += ' ' + masks.map((m: any) => m.text).join(' ');
      }
      
      if (textToEmbed.trim()) {
        const result = await aiClient.models.embedContent({
          model: 'gemini-embedding-2-preview',
          contents: [textToEmbed],
        });
        if (result.embeddings && result.embeddings.length > 0) {
          embeddingStr = JSON.stringify(result.embeddings[0].values);
        }
      }
    } catch (err) {
      console.error('Failed to generate embedding:', err);
      // Continue without embedding if it fails
    }
    
    const insertCard = db.transaction(() => {
      db.prepare('INSERT INTO cards (id, deck_id, type, front, back, image_url, embedding) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(id, deck_id, type, front, back, image_url, embeddingStr);
        
      if (type === 'image_occlusion' && masks && Array.isArray(masks)) {
        const insertMask = db.prepare('INSERT INTO image_masks (id, card_id, x, y, width, height, text) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const mask of masks) {
          insertMask.run(uuidv4(), id, mask.x, mask.y, mask.width, mask.height, mask.text);
        }
      }
    });
    
    insertCard();
    res.json({ id, deck_id, type, front, back, image_url });
  });

  // Backfill Embeddings
  app.post('/api/backfill-embeddings', async (req, res) => {
    try {
      const cards = db.prepare('SELECT * FROM cards WHERE embedding IS NULL').all();
      if (cards.length === 0) {
        return res.json({ status: 'ok', message: 'No cards need backfilling' });
      }

      const aiClient = getAi();
      let count = 0;

      for (const card of cards as any[]) {
        let textToEmbed = card.front || '';
        if (card.back) textToEmbed += ' ' + card.back;
        
        if (card.type === 'image_occlusion') {
          const masks = db.prepare('SELECT * FROM image_masks WHERE card_id = ?').all(card.id);
          textToEmbed += ' ' + masks.map((m: any) => m.text).join(' ');
        }

        if (textToEmbed.trim()) {
          try {
            const result = await aiClient.models.embedContent({
              model: 'gemini-embedding-2-preview',
              contents: [textToEmbed],
            });
            
            if (result.embeddings && result.embeddings.length > 0) {
              const embeddingStr = JSON.stringify(result.embeddings[0].values);
              db.prepare('UPDATE cards SET embedding = ? WHERE id = ?').run(embeddingStr, card.id);
              count++;
            }
          } catch (e) {
            console.error(`Failed to embed card ${card.id}:`, e);
          }
        }
      }

      res.json({ status: 'ok', message: `Backfilled ${count} cards` });
    } catch (err: any) {
      console.error('Backfill error:', err);
      res.status(500).json({ error: 'Backfill failed', details: err.message });
    }
  });

  // Search Cards
  app.get('/api/search', async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.json([]);
    }

    try {
      const aiClient = getAi();
      const result = await aiClient.models.embedContent({
        model: 'gemini-embedding-2-preview',
        contents: [query],
      });

      if (!result.embeddings || result.embeddings.length === 0) {
        return res.json([]);
      }

      const queryEmbedding = result.embeddings[0].values;
      if (!queryEmbedding) {
        return res.json([]);
      }

      // Get all cards with embeddings
      const cards = db.prepare('SELECT * FROM cards WHERE embedding IS NOT NULL').all();
      
      // Calculate cosine similarity
      const dotProduct = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitude = (a: number[]) => Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
      
      const queryMag = magnitude(queryEmbedding);

      const scoredCards = cards.map((card: any) => {
        try {
          const cardEmbedding = JSON.parse(card.embedding);
          const dot = dotProduct(queryEmbedding, cardEmbedding);
          const cardMag = magnitude(cardEmbedding);
          const similarity = dot / (queryMag * cardMag);
          
          // Don't send embedding back to client
          delete card.embedding;
          
          return { ...card, similarity };
        } catch (e) {
          return { ...card, similarity: -1 };
        }
      });

      // Sort by similarity descending and take top 10
      scoredCards.sort((a: any, b: any) => b.similarity - a.similarity);
      const topCards = scoredCards.filter((c: any) => c.similarity > 0.5).slice(0, 10);

      // Fetch masks for image occlusion cards
      const resultsWithMasks = topCards.map((card: any) => {
        if (card.type === 'image_occlusion') {
          card.masks = db.prepare('SELECT * FROM image_masks WHERE card_id = ?').all(card.id);
        }
        return card;
      });

      res.json(resultsWithMasks);
    } catch (err: any) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Search failed', details: err.message, stack: err.stack });
    }
  });

  // Document Upload Pipeline
  app.post('/api/upload-document', upload.single('document'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No document uploaded' });
      }

      const ext = path.extname(req.file.originalname).toLowerCase();
      let extractedText = '';
      let extractedImages: string[] = [];

      if (ext === '.pdf') {
        const data = await pdfParse(fs.readFileSync(req.file.path));
        extractedText = data.text;
      } else if (ext === '.pptx') {
        const zip = new AdmZip(req.file.path);
        const zipEntries = zip.getEntries();
        for (const entry of zipEntries) {
          if (entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')) {
            const content = entry.getData().toString('utf8');
            extractedText += content.replace(/<[^>]+>/g, ' ') + '\n';
          }
          if (entry.entryName.startsWith('ppt/media/') && (entry.entryName.endsWith('.png') || entry.entryName.endsWith('.jpg') || entry.entryName.endsWith('.jpeg'))) {
            const imgExt = path.extname(entry.entryName);
            const filename = Date.now() + '-' + Math.round(Math.random() * 1E9) + imgExt;
            fs.writeFileSync(path.join(uploadDir, filename), entry.getData());
            extractedImages.push(`/uploads/${filename}`);
          }
        }
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ path: req.file.path });
        extractedText = result.value;
      } else {
        return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, PPTX, or DOCX.' });
      }

      // Generate cards from text using Gemini
      let generatedCards: any[] = [];
      if (extractedText.trim()) {
        try {
          const aiClient = getAi();
          const prompt = `Generate a set of flashcards from the following text. Create a mix of Q&A cards and Cloze deletion cards.
          For Q&A, provide 'front' (question) and 'back' (answer).
          For Cloze, provide 'front' (the sentence with the cloze deletion like {{c1::hidden text}}) and 'back' (the full sentence or explanation).
          Return ONLY a JSON array of objects with 'type' ('qa' or 'cloze'), 'front', and 'back'.
          
          Text:
          ${extractedText.substring(0, 30000)} // Limit text to avoid token limits
          `;

          const response = await aiClient.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: { type: Type.STRING, description: "Either 'qa' or 'cloze'" },
                    front: { type: Type.STRING },
                    back: { type: Type.STRING }
                  },
                  required: ["type", "front", "back"]
                }
              }
            }
          });

          if (response.text) {
            generatedCards = JSON.parse(response.text);
          }
        } catch (e) {
          console.error('Failed to generate cards from text:', e);
        }
      }

      res.json({
        text: extractedText.substring(0, 1000) + (extractedText.length > 1000 ? '...' : ''),
        images: extractedImages,
        generatedCards
      });
    } catch (error: any) {
      console.error('Error processing document:', error);
      res.status(500).json({ error: 'Failed to process document', details: error.message });
    }
  });

  // Image Upload Pipeline
  app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const imageUrl = `/uploads/${req.file.filename}`;
      res.json({ imageUrl });
    } catch (error) {
      console.error('Error processing image:', error);
      res.status(500).json({ error: 'Failed to process image' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), 'dist')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
