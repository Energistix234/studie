// Shared types for NeuroDeck

export type CardType = 'qa' | 'cloze' | 'image_occlusion' | 'open' | 'multiple_choice';
export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface Deck {
  id: string;
  name: string;
  created_at: string;
  due_count?: number;
}

export interface MCOption {
  text: string;
  correct: boolean;
}

export interface Card {
  id: string;
  deck_id: string;
  type: CardType;
  front: string;
  back: string;
  image_url?: string;
  options?: string; // JSON string of MCOption[]
  masks?: Mask[];
  embedding?: string;
  created_at: string;
}

export interface Mask {
  id: string;
  card_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

export interface ReviewLog {
  id: string;
  card_id: string;
  rating: Rating;
  review_date: string;
  next_review_date?: string;
  interval?: number;
  ease_factor?: number;
}

export interface GeneratedCard {
  id: string;
  type: CardType;
  front: string;
  back: string;
  options?: MCOption[];
  selected: boolean;
}
