import type { ReactNode } from 'react';
import type { Control, FieldError, FieldValues, Path, RegisterOptions, UseFormRegister } from 'react-hook-form';
import type { Department, MarketKey } from '@/lib/markets';

declare global {
    type TeamRole =
        | 'president'
        | 'vice_president'
        | 'administrator'
        | 'executive_global_pm'
        | 'executive_local_pm'
        | 'deputy_global_pm'
        | 'deputy_local_pm'
        | 'investment_analyst'
        | 'equity_analyst'
        | 'quantitative_analyst'
        | 'alternative_investment_analyst'
        | 'equity_researcher'
        | 'quantitative_researcher'
        | 'quantitative_developer'
        | 'trader';

    type SignInFormData = {
        email: string;
        password: string;
    };

    type YearOfStudy =
        | '1st_year'
        | '2nd_year'
        | '3rd_year'
        | '4th_year'
        | 'honours'
        | 'postgraduate_diploma'
        | 'masters'
        | 'doctorate'
        | 'completed';

    type EducationEntry = {
        degree: string;
        institution: string;
        // ISO country code of the institution; empty when typed in by hand
        institutionCountry: string;
        yearOfStudy: YearOfStudy;
    };

    // Background a member gives at sign-up for the portfolio managers
    type MemberProfile = {
        // Month and day only, 'MM-DD'
        birthday: string;
        education: EducationEntry[];
        careerGoals: string;
        yearGoals: string;
        learningGoals: string;
        linkedinUrl: string;
    };

    type SignUpFormData = MemberProfile & {
        fullName: string;
        email: string;
        password: string;
        department: Department;
        teamRole: TeamRole;
        country: string;
        investmentGoals: string;
        riskTolerance: string;
        preferredIndustry: string;
    };


    type FormInputProps<T extends FieldValues = FieldValues> = {
        name: Path<T>;
        label: string;
        placeholder: string;
        type?: string;
        register: UseFormRegister<T>;
        error?: FieldError;
        validation?: RegisterOptions<T, Path<T>>;
        disabled?: boolean;
        value?: string;
    };

    type Option = {
        value: string;
        label: string;
    };

    type SelectFieldProps<T extends FieldValues = FieldValues> = {
        name: Path<T>;
        label: string;
        placeholder: string;
        options: readonly Option[];
        control: Control<T>;
        error?: FieldError;
        required?: boolean;
    };

    type FooterLinkProps = {
        text: string;
        linkText: string;
        href: string;
    };

    type SearchCommandProps = {
        renderAs?: 'button' | 'text';
        label?: ReactNode;
        ariaLabel?: string;
        className?: string;
        market?: MarketKey;
        initialStocks: StockWithWatchlistStatus[];
    };

    type WelcomeEmailData = {
        email: string;
        name: string;
        intro: string;
    };

    type User = {
        id: string;
        name: string;
        email: string;
        department?: Department;
        teamRole?: TeamRole;
    };

    type UserForNewsEmail = User;

    type Stock = {
        symbol: string;
        name: string;
        exchange: string;
        type: string;
    };

    type StockWithWatchlistStatus = Stock & {
        isInWatchlist: boolean;
    };

    type FinnhubSearchResult = {
        symbol: string;
        description: string;
        displaySymbol?: string;
        type: string;
    };

    type FinnhubSearchResponse = {
        count: number;
        result: FinnhubSearchResult[];
    };

    type StockDetailsPageProps = {
        params: Promise<{
            symbol: string;
        }>;
    };

    type WatchlistButtonProps = {
        symbol: string;
        company: string;
        isInWatchlist: boolean;
        market?: MarketKey;
        showTrashIcon?: boolean;
        type?: 'button' | 'icon';
        onWatchlistChange?: (symbol: string, isAdded: boolean) => void;
    };

    type QuoteData = {
        c?: number;
        d?: number;
        dp?: number;
        h?: number;
        l?: number;
        o?: number;
        pc?: number;
        t?: number;
    };

    type ProfileData = {
        name?: string;
        logo?: string;
        exchange?: string;
        country?: string;
        currency?: string;
        finnhubIndustry?: string;
        ipo?: string;
        marketCapitalization?: number;
        shareOutstanding?: number;
        weburl?: string;
    };

    type FinancialsData = {
        metric?: { [key: string]: number };
    };

    type RecommendationTrend = {
        strongBuy: number;
        buy: number;
        hold: number;
        sell: number;
        strongSell: number;
        period: string;
    };

    type HistoryRange = '1D' | '5D' | '1M' | '6M' | '1Y' | '5Y';

    type PricePoint = {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
    };

    type MarketQuote = {
        symbol: string;
        name: string;
        price: number;
        change?: number;
        changePercent?: number;
        open?: number;
        high?: number;
        low?: number;
        prevClose?: number;
        volume?: number;
        week52High?: number;
        week52Low?: number;
        currency: string;
        exchange?: string;
        time?: number;
    };

    type PriceHistory = {
        points: PricePoint[];
        quote: MarketQuote | null;
    };

    type StockSnapshot = {
        symbol: string;
        company: string;
        logo?: string;
        price?: number;
        change?: number;
        changePercent?: number;
        marketCap?: number;
        peRatio?: number;
        currency: string;
    };

    type StockOverview = {
        market: MarketKey;
        symbol: string;
        company: string;
        logo?: string;
        exchange?: string;
        industry?: string;
        currency: string;
        quote?: MarketQuote;
        marketCap?: number;
        peRatio?: number;
        eps?: number;
        rating?: string;
        sentiment?: string;
        info: {
            ipo?: string;
            country?: string;
            shares?: number;
            employees?: number;
            isin?: string;
            website?: string;
        };
        related: StockSnapshot[];
    };

    type SelectedStock = {
        symbol: string;
        company: string;
        currentPrice?: number;
    };

    type WatchlistTableProps = {
        watchlist: StockWithData[];
        market: MarketKey;
    };

    type StockWithData = {
        userId: string;
        market: MarketKey;
        symbol: string;
        company: string;
        addedAt: Date;
        logo?: string;
        currentPrice?: number;
        change?: number;
        changePercent?: number;
        priceFormatted?: string;
        changeFormatted?: string;
        marketCap?: string;
        peRatio?: string;
    };

    type HoldingWithData = {
        id: string;
        market: MarketKey;
        symbol: string;
        company: string;
        logo?: string;
        shares: number;
        buyPrice: number;
        currentPrice?: number;
        changePercent?: number;
        costBasis: number;
        marketValue?: number;
        gain?: number;
        gainPercent?: number;
        currency: string;
    };

    type PortfolioAuthority = 'executive' | 'deputy' | 'member' | 'observer';

    // A team member as the administrator's Members tab lists them
    type MemberView = {
        id: string;
        name: string;
        email: string;
        department: Department;
        teamRole: TeamRole | null;
        linkedinUrl?: string;
        joinedAt: string | null;
    };

    // An administrator account as executives, the President and Vice President see it on their profile page
    type AdministratorView = {
        id: string;
        name: string;
        email: string;
        addedBy?: string;
        joinedAt: string | null;
    };

    // The signed-in member's own profile page
    type MyProfileView = Partial<MemberProfile> & {
        id: string;
        name: string;
        email: string;
        department: Department;
        teamRole: TeamRole | null;
        joinedAt: string | null;
    };

    // A line in the administrator activity log on the executives', President's and Vice President's profiles
    type AdminActivityView = {
        id: string;
        action: string;
        summary: string;
        admin?: string;
        actor?: string;
        actorRole?: string;
        at: string;
    };

    type AnnouncementView = {
        id: string;
        audience: 'global' | 'local' | 'both';
        title: string;
        message: string;
        postedBy: string;
        emailedTo: number;
        createdAt: string;
    };

    type ProposalAction = 'add' | 'edit' | 'remove';

    // pending -> (delegated -> deputy signs) | (co_authorized -> executive signs) | executive signs -> executed
    type ProposalStatus = 'pending' | 'delegated' | 'co_authorized' | 'executed' | 'rejected' | 'cancelled';

    type ProposalSigner = {
        id: string;
        name: string;
        at: string;
    };

    type ProposalView = {
        id: string;
        market: MarketKey;
        action: ProposalAction;
        symbol: string;
        company: string;
        shares?: number;
        buyPrice?: number;
        previousShares?: number;
        previousBuyPrice?: number;
        note?: string;
        status: ProposalStatus;
        proposedBy: ProposalSigner & { role: string };
        delegatedBy?: ProposalSigner;
        coAuthorizedBy?: ProposalSigner;
        approvedBy?: ProposalSigner;
        rejectedBy?: ProposalSigner & { reason?: string };
        currency: string;
        // What the signed-in viewer may do with this request
        canApprove: boolean;
        canDelegate: boolean;
        canCoAuthorize: boolean;
        canReject: boolean;
        canCancel: boolean;
    };

    type TeamPortfolioView = {
        allowed: boolean;
        authority: PortfolioAuthority | null;
        holdings: HoldingWithData[];
        summary: PortfolioSummary;
        pending: ProposalView[];
        history: ProposalView[];
    };

    type PortfolioSummary = {
        totalValue: number;
        totalCost: number;
        totalGain: number;
        totalGainPercent: number;
        dayChange: number;
        currency: string;
    };

    type AlertsListProps = {
        alertData: Alert[] | undefined;
        watchlist: SelectedStock[];
        market: MarketKey;
    };

    type MarketNewsArticle = {
        id: number;
        headline: string;
        summary: string;
        source: string;
        url: string;
        datetime: number;
        category: string;
        related: string;
        image?: string;
    };

    type NewsTab = 'top' | 'local' | 'world';

    type WatchlistNewsProps = {
        news?: MarketNewsArticle[];
    };

    type AlertFrequency = 'once_per_minute' | 'once_per_hour' | 'once_per_day';

    type AlertData = {
        symbol: string;
        company: string;
        alertName: string;
        alertType: 'upper' | 'lower';
        threshold: string;
        frequency: AlertFrequency;
        market?: MarketKey;
    };

    type AlertModalProps = {
        alertId?: string;
        alertData?: AlertData;
        action?: 'create' | 'edit';
        market?: MarketKey;
        stocks?: SelectedStock[];
        open: boolean;
        setOpen: (open: boolean) => void;
    };

    type RawNewsArticle = {
        id: number;
        headline?: string;
        summary?: string;
        source?: string;
        url?: string;
        datetime?: number;
        image?: string;
        category?: string;
        related?: string;
    };

    type Alert = {
        id: string;
        market: MarketKey;
        symbol: string;
        company: string;
        alertName: string;
        currentPrice: number;
        alertType: 'upper' | 'lower';
        threshold: number;
        frequency: AlertFrequency;
        changePercent?: number;
        logo?: string;
        currency: string;
    };

    type StockAlertEmailData = {
        email: string;
        symbol: string;
        company: string;
        alertType: 'upper' | 'lower';
        currentPrice: number;
        targetPrice: number;
        changePercent?: number;
        currency?: string;
        timestamp: string;
    };
}

export {};
