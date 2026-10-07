import { Schema, model, models, type Document, type Model } from 'mongoose';
import type { MarketKey } from '@/lib/markets';

type Signer = { id: string; name: string; at: Date };

// A requested change to a team portfolio and every signature on it (the audit trail)
export interface PortfolioProposalItem extends Document {
  market: MarketKey;
  action: ProposalAction;
  symbol: string;
  company: string;
  holdingId?: string;
  shares?: number;
  buyPrice?: number;
  previousShares?: number;
  previousBuyPrice?: number;
  note?: string;
  status: ProposalStatus;
  proposedBy: Signer & { role: string };
  delegatedBy?: Signer;
  coAuthorizedBy?: Signer;
  approvedBy?: Signer;
  rejectedBy?: Signer & { reason?: string };
  createdAt: Date;
}

const SignerSchema = new Schema({ id: String, name: String, at: Date }, { _id: false });

const PortfolioProposalSchema = new Schema<PortfolioProposalItem>(
  {
    market: { type: String, enum: ['global', 'local'], required: true, index: true },
    action: { type: String, enum: ['add', 'edit', 'remove'], required: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    company: { type: String, required: true, trim: true },
    holdingId: { type: String },
    shares: { type: Number },
    buyPrice: { type: Number },
    previousShares: { type: Number },
    previousBuyPrice: { type: Number },
    note: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: ['pending', 'delegated', 'co_authorized', 'executed', 'rejected', 'cancelled'],
      default: 'pending',
      index: true,
    },
    proposedBy: { type: new Schema({ id: String, name: String, role: String, at: Date }, { _id: false }), required: true },
    delegatedBy: SignerSchema,
    coAuthorizedBy: SignerSchema,
    approvedBy: SignerSchema,
    rejectedBy: new Schema({ id: String, name: String, at: Date, reason: String }, { _id: false }),
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const PortfolioProposal: Model<PortfolioProposalItem> =
  (models?.PortfolioProposal as Model<PortfolioProposalItem>) ||
  model<PortfolioProposalItem>('PortfolioProposal', PortfolioProposalSchema);
