'use server';

import { unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { connectToDatabase } from '@/database/mongoose';
import { TeamHolding } from '@/database/models/team-holding.model';
import { PortfolioProposal, type PortfolioProposalItem } from '@/database/models/portfolio-proposal.model';
import { getSessionUser } from '@/lib/better-auth/session';
import { getCompanyProfile } from '@/lib/actions/finnhub.actions';
import { getYahooQuote } from '@/lib/actions/yahoo.actions';
import { getStockSnapshots } from '@/lib/actions/market.actions';
import {
  DEPUTY_ROLES,
  isMarketKey,
  LOCAL_STOCKS,
  marketHref,
  MARKETS,
  portfolioAuthority,
  type MarketKey,
} from '@/lib/markets';

// Approval flow for a department's shared team portfolio:
// - the executive portfolio manager's own changes apply immediately
// - everyone else's changes are requests that the executive approves, or
//   delegates to the deputy to approve, or the deputy co-authorises and the executive signs
// - nobody approves their own request, and members only see their own department's portfolio

const ACTIVE: ProposalStatus[] = ['pending', 'delegated', 'co_authorized'];

type ChangeInput = {
  market: MarketKey;
  action: ProposalAction;
  symbol?: string;
  holdingId?: string;
  shares?: string | number;
  buyPrice?: string | number;
  note?: string;
};

type Decision = 'approve' | 'reject' | 'delegate' | 'coauthorize';

const toNumber = (value?: string | number) => Number.parseFloat(String(value ?? '').replace(/[$R,\s]/g, ''));

const signer = (user: User) => ({ id: user.id, name: user.name, at: new Date() });

const revalidatePortfolio = (market: MarketKey) => {
  revalidatePath(marketHref(market, '/portfolio'));
  revalidatePath(marketHref(market, '/news'));
};

const parseAmounts = (input: ChangeInput) => {
  const shares = toNumber(input.shares);
  const buyPrice = toNumber(input.buyPrice);
  if (!Number.isFinite(shares) || shares <= 0) throw new Error('Shares must be a positive number');
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) throw new Error('Buy price must be a positive number');
  return { shares, buyPrice };
};

// Confirms the ticker exists in the market and returns the company name
const resolveCompany = async (market: MarketKey, symbol: string) => {
  if (market === 'local') {
    const known = LOCAL_STOCKS.find((s) => s.symbol === symbol);
    if (known) return known.name;
    const quote = await getYahooQuote(`${symbol}.JO`);
    if (!quote) throw new Error(`${symbol} isn't listed on the JSE`);
    return quote.name;
  }

  const profile = await getCompanyProfile(symbol);
  if (profile && !profile.name) throw new Error(`${symbol} wasn't found`);
  return profile?.name || symbol;
};

// Applies an approved request to the team portfolio
const applyChange = async (proposal: PortfolioProposalItem) => {
  const { market, symbol } = proposal;

  if (proposal.action === 'add') {
    const existing = await TeamHolding.findOne({ market, symbol });
    if (existing) {
      // Buying more of a held stock averages the cost
      const totalShares = existing.shares + proposal.shares!;
      existing.buyPrice = (existing.shares * existing.buyPrice + proposal.shares! * proposal.buyPrice!) / totalShares;
      existing.shares = totalShares;
      existing.updatedAt = new Date();
      await existing.save();
    } else {
      await TeamHolding.create({ market, symbol, company: proposal.company, shares: proposal.shares, buyPrice: proposal.buyPrice });
    }
    return;
  }

  if (proposal.action === 'edit') {
    const updated = await TeamHolding.findOneAndUpdate(
      { _id: proposal.holdingId, market },
      { $set: { shares: proposal.shares, buyPrice: proposal.buyPrice, updatedAt: new Date() } }
    );
    if (!updated) throw new Error(`${symbol} is no longer in the portfolio`);
    return;
  }

  const removed = await TeamHolding.findOneAndDelete({ _id: proposal.holdingId, market });
  if (!removed) throw new Error(`${symbol} is no longer in the portfolio`);
};

// Marks a request executed and applies it; rolls the status back if the change can't be applied
const execute = async (proposalId: string, fromStatuses: ProposalStatus[], approvedBy: ReturnType<typeof signer>) => {
  const claimed = await PortfolioProposal.findOneAndUpdate(
    { _id: proposalId, status: { $in: fromStatuses } },
    { $set: { status: 'executed', approvedBy } },
    { new: false }
  );
  if (!claimed) throw new Error('This request has already been handled');

  try {
    await applyChange(claimed);
  } catch (err) {
    await PortfolioProposal.updateOne({ _id: proposalId }, { $set: { status: claimed.status }, $unset: { approvedBy: 1 } });
    throw err;
  }
  return claimed;
};

export async function submitPortfolioChange(input: ChangeInput) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    const market: MarketKey = isMarketKey(input.market) ? input.market : 'global';
    const authority = portfolioAuthority(user, market);
    if (!authority || authority === 'observer') return { success: false, error: `Only ${MARKETS[market].teamName} members can change this portfolio` };

    await connectToDatabase();

    let details: Record<string, unknown>;
    if (input.action === 'add') {
      const symbol = (input.symbol ?? '').trim().toUpperCase().replace(/\.JO$/, '');
      if (!symbol) return { success: false, error: 'Enter a stock symbol' };
      details = { symbol, company: await resolveCompany(market, symbol), ...parseAmounts(input) };
    } else if (input.action === 'edit' || input.action === 'remove') {
      const holding = await TeamHolding.findOne({ _id: input.holdingId, market });
      if (!holding) return { success: false, error: 'That holding is no longer in the portfolio' };
      details = {
        symbol: holding.symbol,
        company: holding.company,
        holdingId: String(holding._id),
        previousShares: holding.shares,
        previousBuyPrice: holding.buyPrice,
        ...(input.action === 'edit' ? parseAmounts(input) : {}),
      };
    } else {
      return { success: false, error: 'Unknown change' };
    }

    const proposal = await PortfolioProposal.create({
      market,
      action: input.action,
      ...details,
      note: input.note?.trim() || undefined,
      proposedBy: { ...signer(user), role: user.teamRole ?? 'member' },
    });

    // The executive's own changes are signed and applied straight away
    if (authority === 'executive') {
      try {
        await execute(String(proposal._id), ['pending'], signer(user));
      } catch (err) {
        await PortfolioProposal.deleteOne({ _id: proposal._id });
        throw err;
      }
      revalidatePortfolio(market);
      return { success: true, executed: true };
    }

    revalidatePortfolio(market);
    return { success: true, executed: false };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('submitPortfolioChange error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to submit change' };
  }
}

export async function reviewPortfolioChange(proposalId: string, decision: Decision, reason?: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    await connectToDatabase();
    const proposal = await PortfolioProposal.findById(proposalId);
    if (!proposal) return { success: false, error: 'Request not found' };

    const market = proposal.market;
    const authority = portfolioAuthority(user, market);
    const isOwn = proposal.proposedBy.id === user.id;
    const proposedByDeputy = proposal.proposedBy.role === DEPUTY_ROLES[market];
    const status = proposal.status;

    if (authority !== 'executive' && authority !== 'deputy') {
      return { success: false, error: 'Only the executive or deputy portfolio manager can review requests' };
    }
    if (authority === 'deputy' && isOwn) {
      return { success: false, error: 'The executive portfolio manager must sign your own requests' };
    }

    if (decision === 'approve') {
      // The executive can sign at any stage; the deputy only once the executive has delegated this request
      const allowed: ProposalStatus[] = authority === 'executive' ? ACTIVE : ['delegated'];
      if (!allowed.includes(status)) {
        return { success: false, error: 'The executive portfolio manager has to authorise this request first' };
      }
      await execute(proposalId, allowed, signer(user));
    } else if (decision === 'delegate') {
      if (authority !== 'executive') return { success: false, error: 'Only the executive portfolio manager can delegate' };
      if (status !== 'pending') return { success: false, error: 'Only new requests can be delegated' };
      if (proposedByDeputy) return { success: false, error: "The deputy can't approve their own request" };
      await PortfolioProposal.updateOne({ _id: proposalId, status: 'pending' }, { $set: { status: 'delegated', delegatedBy: signer(user) } });
    } else if (decision === 'coauthorize') {
      if (authority !== 'deputy') return { success: false, error: 'Only the deputy portfolio manager can co-authorise' };
      if (status !== 'pending') return { success: false, error: 'Only new requests can be co-authorised' };
      await PortfolioProposal.updateOne({ _id: proposalId, status: 'pending' }, { $set: { status: 'co_authorized', coAuthorizedBy: signer(user) } });
    } else if (decision === 'reject') {
      const allowed: ProposalStatus[] = authority === 'executive' ? ACTIVE : ['delegated'];
      if (!allowed.includes(status)) return { success: false, error: "You can't reject this request" };
      await PortfolioProposal.updateOne(
        { _id: proposalId, status: { $in: allowed } },
        { $set: { status: 'rejected', rejectedBy: { ...signer(user), reason: reason?.trim() || undefined } } }
      );
    } else {
      return { success: false, error: 'Unknown decision' };
    }

    revalidatePortfolio(market);
    return { success: true };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('reviewPortfolioChange error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to review request' };
  }
}

export async function cancelPortfolioChange(proposalId: string) {
  try {
    const user = await getSessionUser();
    if (!user) return { success: false, error: 'You need to be signed in' };

    await connectToDatabase();
    const proposal = await PortfolioProposal.findOneAndUpdate(
      { _id: proposalId, 'proposedBy.id': user.id, status: { $in: ACTIVE } },
      { $set: { status: 'cancelled' } }
    );
    if (!proposal) return { success: false, error: 'Only your own open requests can be cancelled' };

    revalidatePortfolio(proposal.market);
    return { success: true };
  } catch (err) {
    unstable_rethrow(err);
    console.error('cancelPortfolioChange error:', err);
    return { success: false, error: 'Failed to cancel request' };
  }
}

const toView = (
  p: PortfolioProposalItem,
  viewer: User,
  authority: PortfolioAuthority,
  deputyExists: boolean,
  currency: string
): ProposalView => {
  const isOwn = p.proposedBy.id === viewer.id;
  const active = ACTIVE.includes(p.status);
  const proposedByDeputy = p.proposedBy.role === DEPUTY_ROLES[p.market];
  const signed = (s?: { id: string; name: string; at: Date }) => (s?.id ? { id: s.id, name: s.name, at: new Date(s.at).toISOString() } : undefined);

  return {
    id: String(p._id),
    market: p.market,
    action: p.action,
    symbol: p.symbol,
    company: p.company,
    shares: p.shares,
    buyPrice: p.buyPrice,
    previousShares: p.previousShares,
    previousBuyPrice: p.previousBuyPrice,
    note: p.note,
    status: p.status,
    proposedBy: { ...signed(p.proposedBy)!, role: p.proposedBy.role },
    delegatedBy: signed(p.delegatedBy),
    coAuthorizedBy: signed(p.coAuthorizedBy),
    approvedBy: signed(p.approvedBy),
    rejectedBy: p.rejectedBy?.id ? { ...signed(p.rejectedBy)!, reason: p.rejectedBy.reason } : undefined,
    currency,
    canApprove: active && (authority === 'executive' || (authority === 'deputy' && !isOwn && p.status === 'delegated')),
    canDelegate: authority === 'executive' && p.status === 'pending' && !proposedByDeputy && deputyExists,
    canCoAuthorize: authority === 'deputy' && !isOwn && p.status === 'pending',
    canReject: active && (authority === 'executive' || (authority === 'deputy' && !isOwn && p.status === 'delegated')),
    canCancel: active && isOwn,
  };
};

// The signed-in member's department portfolio, valued at the latest price, with open requests and history
export async function getTeamPortfolio(market: MarketKey = 'global'): Promise<TeamPortfolioView> {
  const currency = MARKETS[market].currency;
  const emptySummary = { totalValue: 0, totalCost: 0, totalGain: 0, totalGainPercent: 0, dayChange: 0, currency };
  const denied: TeamPortfolioView = { allowed: false, authority: null, holdings: [], summary: emptySummary, pending: [], history: [] };

  try {
    const user = await getSessionUser();
    const authority = portfolioAuthority(user, market);
    if (!user || !authority) return denied;

    const mongoose = await connectToDatabase();
    const [items, active, past, deputyExists] = await Promise.all([
      TeamHolding.find({ market }).sort({ addedAt: -1 }).lean(),
      PortfolioProposal.find({ market, status: { $in: ACTIVE } }).sort({ createdAt: -1 }),
      PortfolioProposal.find({ market, status: { $nin: ACTIVE } }).sort({ createdAt: -1 }).limit(20),
      mongoose.connection.db?.collection('user').countDocuments({ teamRole: DEPUTY_ROLES[market] }).then((n) => n > 0) ?? false,
    ]);

    const snapshots = await getStockSnapshots(market, items.map((i) => ({ symbol: i.symbol, company: i.company })));

    const holdings: HoldingWithData[] = items.map((item, index) => {
      const snap = snapshots[index];
      const costBasis = item.shares * item.buyPrice;
      const marketValue = snap?.price ? item.shares * snap.price : undefined;
      const gain = marketValue != null ? marketValue - costBasis : undefined;
      return {
        id: String(item._id),
        market,
        symbol: item.symbol,
        company: snap?.company || item.company,
        logo: snap?.logo,
        shares: item.shares,
        buyPrice: item.buyPrice,
        currentPrice: snap?.price,
        changePercent: snap?.changePercent,
        costBasis,
        marketValue,
        gain,
        gainPercent: gain != null && costBasis ? (gain / costBasis) * 100 : undefined,
        currency: snap?.currency || currency,
      };
    });

    // Positions without a live price are valued at cost so the totals stay meaningful
    const totalValue = holdings.reduce((sum, h) => sum + (h.marketValue ?? h.costBasis), 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const dayChange = holdings.reduce((sum, h, i) => sum + (snapshots[i]?.change ?? 0) * h.shares, 0);

    return {
      allowed: true,
      authority,
      holdings,
      summary: {
        totalValue,
        totalCost,
        totalGain: totalValue - totalCost,
        totalGainPercent: totalCost ? ((totalValue - totalCost) / totalCost) * 100 : 0,
        dayChange,
        currency,
      },
      pending: active.map((p) => toView(p, user, authority, deputyExists, currency)),
      history: past.map((p) => toView(p, user, authority, deputyExists, currency)),
    };
  } catch (err) {
    // Let Next.js handle its own control-flow errors (dynamic rendering, redirects)
    unstable_rethrow(err);
    console.error('getTeamPortfolio error:', err);
    return denied;
  }
}

// Team holdings for news, only for members of that department
export async function getHoldingStocks(market: MarketKey = 'global'): Promise<{ symbol: string; company: string }[]> {
  try {
    const user = await getSessionUser();
    if (!portfolioAuthority(user, market)) return [];

    await connectToDatabase();
    const items = await TeamHolding.find({ market }, { symbol: 1, company: 1 }).lean();
    return items.map((i) => ({ symbol: i.symbol, company: i.company }));
  } catch (err) {
    unstable_rethrow(err);
    console.error('getHoldingStocks error:', err);
    return [];
  }
}
