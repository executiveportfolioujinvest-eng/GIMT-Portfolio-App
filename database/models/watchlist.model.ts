import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketKey } from '@/lib/markets';

export interface WatchlistItem extends Document {
  userId: string;
  market: MarketKey;
  symbol: string;
  company: string;
  addedAt: Date;
}

const WatchlistSchema = new Schema<WatchlistItem>(
  {
    userId: { type: String, required: true, index: true },
    market: { type: String, enum: ['global', 'local'], default: 'global', index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    addedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Prevent duplicate symbols per user and market
WatchlistSchema.index({ userId: 1, market: 1, symbol: 1 }, { unique: true });

export const Watchlist: Model<WatchlistItem> =
  (models?.Watchlist as Model<WatchlistItem>) || model<WatchlistItem>('Watchlist', WatchlistSchema);
