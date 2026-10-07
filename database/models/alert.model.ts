import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketKey } from '@/lib/markets';

export interface AlertItem extends Document {
  userId: string;
  market: MarketKey;
  symbol: string;
  company: string;
  alertName: string;
  alertType: 'upper' | 'lower';
  threshold: number;
  frequency: AlertFrequency;
  lastTriggeredAt?: Date;
  // Quote timestamp (seconds) at the last trigger, so a closed market doesn't re-send the same alert
  lastTriggeredQuoteTime?: number;
  createdAt: Date;
}

const AlertSchema = new Schema<AlertItem>(
  {
    userId: { type: String, required: true, index: true },
    market: { type: String, enum: ['global', 'local'], default: 'global', index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    alertName: { type: String, required: true, trim: true },
    alertType: { type: String, enum: ['upper', 'lower'], required: true },
    threshold: { type: Number, required: true },
    frequency: { type: String, enum: ['once_per_minute', 'once_per_hour', 'once_per_day'], default: 'once_per_day' },
    lastTriggeredAt: { type: Date },
    lastTriggeredQuoteTime: { type: Number },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const AlertModel: Model<AlertItem> =
  (models?.Alert as Model<AlertItem>) || model<AlertItem>('Alert', AlertSchema);
