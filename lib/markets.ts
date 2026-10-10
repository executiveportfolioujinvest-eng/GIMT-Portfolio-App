// Global Markets (GMIT) and Local Markets (LMIT) run the same app with jurisdiction-specific data.
// Global uses Finnhub + TradingView (US coverage); local uses Yahoo Finance + Google News (JSE coverage),
// because TradingView embeds and Finnhub's free plan don't carry JSE data.

export type MarketKey = 'global' | 'local';

export type SummarySymbol = {
    symbol: string;   // Yahoo Finance symbol
    label: string;
    badge?: string;
};

export type SummaryTab = {
    label: string;
    symbols: SummarySymbol[];
};

export type LocalStock = {
    symbol: string;   // JSE ticker without the .JO suffix
    name: string;
    sector: string;
};

export type MarketConfig = {
    key: MarketKey;
    team: string;
    teamName: string;
    label: string;
    basePath: '' | '/local';
    currency: 'USD' | 'ZAR';
    locale: string;
    exchange: string;
    summaryTabs: SummaryTab[];
};

export const LOCAL_STOCKS: LocalStock[] = [
    { symbol: 'NPN', name: 'Naspers Limited', sector: 'Technology' },
    { symbol: 'PRX', name: 'Prosus N.V.', sector: 'Technology' },
    { symbol: 'FSR', name: 'FirstRand Limited', sector: 'Financials' },
    { symbol: 'SBK', name: 'Standard Bank Group Limited', sector: 'Financials' },
    { symbol: 'CPI', name: 'Capitec Limited', sector: 'Financials' },
    { symbol: 'ABG', name: 'Absa Group Limited', sector: 'Financials' },
    { symbol: 'NED', name: 'Nedbank Group Limited', sector: 'Financials' },
    { symbol: 'SLM', name: 'Sanlam Limited', sector: 'Financials' },
    { symbol: 'DSY', name: 'Discovery Limited', sector: 'Financials' },
    { symbol: 'INL', name: 'Investec Group', sector: 'Financials' },
    { symbol: 'MTN', name: 'MTN Group Limited', sector: 'Telecommunications' },
    { symbol: 'VOD', name: 'Vodacom Group Limited', sector: 'Telecommunications' },
    { symbol: 'CFR', name: 'Compagnie Financière Richemont SA', sector: 'Consumer' },
    { symbol: 'BTI', name: 'British American Tobacco p.l.c.', sector: 'Consumer' },
    { symbol: 'SHP', name: 'Shoprite Holdings Ltd', sector: 'Consumer' },
    { symbol: 'CLS', name: 'Clicks Group Limited', sector: 'Consumer' },
    { symbol: 'BID', name: 'Bid Corporation Limited', sector: 'Consumer' },
    { symbol: 'AGL', name: 'Anglo American plc', sector: 'Resources' },
    { symbol: 'GFI', name: 'Gold Fields Limited', sector: 'Resources' },
    { symbol: 'HAR', name: 'Harmony Gold Mining Company Limited', sector: 'Resources' },
    { symbol: 'IMP', name: 'Impala Platinum Holdings Limited', sector: 'Resources' },
    { symbol: 'VAL', name: 'Valterra Platinum Limited', sector: 'Resources' },
    { symbol: 'SOL', name: 'Sasol Limited', sector: 'Resources' },
    { symbol: 'MNP', name: 'Mondi plc', sector: 'Industrials' },
    { symbol: 'REM', name: 'Remgro Limited', sector: 'Industrials' },
];

// Sector tabs on the LMIT Market Overview panel
export const LOCAL_OVERVIEW_TABS: { label: string; sectors: string[] }[] = [
    { label: 'Financials', sectors: ['Financials'] },
    { label: 'Resources', sectors: ['Resources'] },
    { label: 'Consumer', sectors: ['Consumer'] },
    { label: 'Tech & Telecom', sectors: ['Technology', 'Telecommunications'] },
    { label: 'Industrials', sectors: ['Industrials'] },
];

export const MARKETS: Record<MarketKey, MarketConfig> = {
    global: {
        key: 'global',
        team: 'GMIT',
        teamName: 'Global Markets Investment Team',
        label: 'Global markets',
        basePath: '',
        currency: 'USD',
        locale: 'en-US',
        exchange: 'US',
        summaryTabs: [
            { label: 'Indices', symbols: [
                { symbol: '^GSPC', label: 'S&P 500', badge: '500' },
                { symbol: '^NDX', label: 'Nasdaq 100', badge: '100' },
                { symbol: '^DJI', label: 'Dow 30', badge: '30' },
            ] },
            { label: 'Stocks', symbols: [
                { symbol: 'AAPL', label: 'Apple', badge: 'AAPL' },
                { symbol: 'MSFT', label: 'Microsoft', badge: 'MSFT' },
                { symbol: 'NVDA', label: 'NVIDIA', badge: 'NVDA' },
            ] },
            { label: 'Crypto', symbols: [
                { symbol: 'BTC-USD', label: 'Bitcoin', badge: 'BTC' },
                { symbol: 'ETH-USD', label: 'Ethereum', badge: 'ETH' },
                { symbol: 'SOL-USD', label: 'Solana', badge: 'SOL' },
            ] },
            { label: 'Forex', symbols: [
                { symbol: 'EURUSD=X', label: 'EUR/USD', badge: 'FX' },
                { symbol: 'GBPUSD=X', label: 'GBP/USD', badge: 'FX' },
                { symbol: 'USDZAR=X', label: 'USD/ZAR', badge: 'FX' },
            ] },
            { label: 'Bonds', symbols: [
                { symbol: '^TNX', label: 'US 10Y Yield', badge: '10Y' },
                { symbol: '^FVX', label: 'US 5Y Yield', badge: '5Y' },
                { symbol: '^TYX', label: 'US 30Y Yield', badge: '30Y' },
            ] },
            { label: 'ETFs', symbols: [
                { symbol: 'SPY', label: 'SPDR S&P 500', badge: 'SPY' },
                { symbol: 'QQQ', label: 'Invesco QQQ', badge: 'QQQ' },
                { symbol: 'DIA', label: 'SPDR Dow Jones', badge: 'DIA' },
            ] },
        ],
    },
    local: {
        key: 'local',
        team: 'LMIT',
        teamName: 'Local Markets Investment Team',
        label: 'Local market',
        basePath: '/local',
        currency: 'ZAR',
        locale: 'en-ZA',
        exchange: 'JSE',
        summaryTabs: [
            { label: 'Indices', symbols: [
                { symbol: '^J200.JO', label: 'JSE Top 40', badge: '40' },
                { symbol: '^J203.JO', label: 'All Share', badge: 'ALSI' },
                { symbol: '^J212.JO', label: 'Financial 15', badge: '15' },
            ] },
            { label: 'Stocks', symbols: [
                { symbol: 'NPN.JO', label: 'Naspers', badge: 'NPN' },
                { symbol: 'FSR.JO', label: 'FirstRand', badge: 'FSR' },
                { symbol: 'MTN.JO', label: 'MTN Group', badge: 'MTN' },
            ] },
            { label: 'Sectors', symbols: [
                { symbol: '^J210.JO', label: 'Resource 10', badge: '10' },
                { symbol: '^J211.JO', label: 'Industrial 25', badge: '25' },
                { symbol: '^J213.JO', label: 'Fin & Ind 30', badge: '30' },
            ] },
            { label: 'Currencies', symbols: [
                { symbol: 'USDZAR=X', label: 'USD/ZAR', badge: 'FX' },
                { symbol: 'EURZAR=X', label: 'EUR/ZAR', badge: 'FX' },
                { symbol: 'GBPZAR=X', label: 'GBP/ZAR', badge: 'FX' },
            ] },
            { label: 'Commodities', symbols: [
                { symbol: 'GC=F', label: 'Gold', badge: 'XAU' },
                { symbol: 'PL=F', label: 'Platinum', badge: 'XPT' },
                { symbol: 'BZ=F', label: 'Brent Crude', badge: 'OIL' },
            ] },
            { label: 'ETFs', symbols: [
                { symbol: 'STX40.JO', label: 'Satrix 40', badge: 'STX40' },
                { symbol: 'STX500.JO', label: 'Satrix S&P 500', badge: 'S&P' },
                { symbol: 'STXIND.JO', label: 'Satrix INDI', badge: 'INDI' },
            ] },
        ],
    },
};

export const isMarketKey = (value: unknown): value is MarketKey => value === 'global' || value === 'local';

export const marketFromPathname = (pathname: string): MarketKey =>
    pathname === '/local' || pathname.startsWith('/local/') ? 'local' : 'global';

// Prefixes an app path with the market's base path ('/' becomes '/local' for the local market)
export const marketHref = (market: MarketKey, path: string) => {
    const base = MARKETS[market].basePath;
    if (!base) return path;
    return path === '/' ? base : `${base}${path}`;
};

// 'both' is the President and Vice President, who oversee the two departments
export type Department = MarketKey | 'both';

export const DEPARTMENT_OPTIONS: { value: Department; label: string }[] = [
    { value: 'global', label: 'Global Markets Department' },
    { value: 'local', label: 'Local Markets Department' },
    { value: 'both', label: 'Both Portfolios (President / Vice President)' },
];

export const isDepartment = (value: unknown): value is Department => isMarketKey(value) || value === 'both';

export const departmentLabel = (department?: string | null) =>
    DEPARTMENT_OPTIONS.find((d) => d.value === department)?.label.replace(/ \(.*\)$/, '') ?? 'Global Markets Department';

// Each department has exactly one executive portfolio manager, who heads its sub-committee,
// and one deputy portfolio manager
export const EXECUTIVE_ROLES: Record<MarketKey, TeamRole> = {
    global: 'executive_global_pm',
    local: 'executive_local_pm',
};

export const DEPUTY_ROLES: Record<MarketKey, TeamRole> = {
    global: 'deputy_global_pm',
    local: 'deputy_local_pm',
};

// The President and Vice President see both departments (view only), to monitor the portfolio managers
export const OVERSIGHT_ROLES: TeamRole[] = ['president', 'vice_president'];

// Runs the administrator console (members, dashboards, announcements) for both departments. Never offered at
// sign-up: an executive PM, the President or Vice President adds the account and enters it from their profile page
export const ADMIN_ROLE: TeamRole = 'administrator';

// Roles offered at sign-up (everything except administrator)
export const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
    { value: 'president', label: 'President' },
    { value: 'vice_president', label: 'Vice President' },
    { value: 'executive_global_pm', label: 'Executive Global Markets Portfolio Manager' },
    { value: 'executive_local_pm', label: 'Executive Local Markets Portfolio Manager' },
    { value: 'deputy_global_pm', label: 'Deputy Global Markets Portfolio Manager' },
    { value: 'deputy_local_pm', label: 'Deputy Local Markets Portfolio Manager' },
    { value: 'investment_analyst', label: 'Investment Analyst' },
    { value: 'equity_analyst', label: 'Equity Analyst' },
    { value: 'quantitative_analyst', label: 'Quantitative Analyst' },
    { value: 'alternative_investment_analyst', label: 'Alternative Investment Analyst' },
    { value: 'equity_researcher', label: 'Equity Researcher' },
    { value: 'quantitative_researcher', label: 'Quantitative Researcher' },
    { value: 'quantitative_developer', label: 'Quantitative Developer' },
    { value: 'trader', label: 'Trader' },
];

export const isSignUpRole = (value: unknown): value is TeamRole => ROLE_OPTIONS.some((r) => r.value === value);

export const isExecutiveRole = (role: unknown): boolean => Object.values(EXECUTIVE_ROLES).includes(role as TeamRole);

export const isOversightRole = (role: unknown): boolean => OVERSIGHT_ROLES.includes(role as TeamRole);

export const isAdminRole = (role: unknown): boolean => role === ADMIN_ROLE;

// Single seats: one executive and one deputy per department, one President and one Vice President
export const LEADERSHIP_ROLES: TeamRole[] = [...Object.values(EXECUTIVE_ROLES), ...Object.values(DEPUTY_ROLES), ...OVERSIGHT_ROLES];

export const isLeadershipRole = (role: unknown): boolean => LEADERSHIP_ROLES.includes(role as TeamRole);

// The department a leadership role belongs to (sub-committee roles belong to either Global or Local)
export const departmentForLeadershipRole = (role: unknown): Department | null => {
    if (isOversightRole(role)) return 'both';
    return (['global', 'local'] as MarketKey[]).find((d) => EXECUTIVE_ROLES[d] === role || DEPUTY_ROLES[d] === role) ?? null;
};

// Whether a role can be held in a department: 'both' is only for the President and Vice President
export const roleFitsDepartment = (role: unknown, department: unknown): boolean => {
    const seatOf = departmentForLeadershipRole(role);
    if (department === 'both') return seatOf === 'both';
    return isMarketKey(department) && (seatOf === null || seatOf === department);
};

export const roleLabel = (role?: string | null) =>
    role === ADMIN_ROLE ? 'Administrator' : ROLE_OPTIONS.find((r) => r.value === role)?.label ?? 'Team member';

type TeamMember = { department?: string | null; teamRole?: string | null } | null | undefined;

// The executives, President, Vice President and administrators can move between the Global and Local sections
export const canSwitchMarkets = (role: unknown): boolean => isExecutiveRole(role) || isOversightRole(role) || isAdminRole(role);

// Executive PMs, the President and Vice President add administrators from their profile page
export const canCreateAdministrators = (role: unknown): boolean => isExecutiveRole(role) || isOversightRole(role);

// Members only see their own department's section
export const canAccessMarket = (user: TeamMember, market: MarketKey): boolean =>
    !!user && (marketForDepartment(user.department) === market || canSwitchMarkets(user.teamRole));

// What a member may do with a department's team portfolio. 'observer' is view only: the other department's
// executive, and the President and Vice President for both portfolios. Administrators propose changes to
// either portfolio, which that department's executive signs like anyone else's
export const portfolioAuthority = (user: TeamMember, market: MarketKey): PortfolioAuthority | null => {
    if (!user) return null;
    if (isAdminRole(user.teamRole)) return 'member';
    if (isOversightRole(user.teamRole)) return 'observer';
    if (marketForDepartment(user.department) !== market) return isExecutiveRole(user.teamRole) ? 'observer' : null;
    if (user.teamRole === EXECUTIVE_ROLES[market]) return 'executive';
    if (user.teamRole === DEPUTY_ROLES[market]) return 'deputy';
    return 'member';
};

// Users land on their own department's dashboard (the President and Vice President start on Global)
export const marketForDepartment = (department?: string | null): MarketKey => (department === 'local' ? 'local' : 'global');

// Where a user lands after signing in, or when they open a page they can't use
export const homeHref = (user: TeamMember): string =>
    isAdminRole(user?.teamRole) ? '/admin' : marketHref(marketForDepartment(user?.department), '/');

// Dashboard sections the administrator can show or hide, per department
export const DASHBOARD_SECTIONS: Record<MarketKey, { key: string; label: string }[]> = {
    global: [
        { key: 'overview', label: 'Market Overview (TradingView)' },
        { key: 'heatmap', label: 'Market Cap heatmap (TradingView)' },
        { key: 'stories', label: 'Top Stories (TradingView)' },
        { key: 'quotes', label: 'Market Data quotes (TradingView)' },
        { key: 'summary', label: 'Market Summary' },
        { key: 'watchlist', label: 'Your Watchlist' },
        { key: 'top-stocks', label: "Today's Top Stocks" },
        { key: 'news', label: "Today's Financial News" },
    ],
    local: [
        { key: 'overview', label: 'Market Overview' },
        { key: 'heatmap', label: 'Market Cap heatmap' },
        { key: 'stories', label: 'Top Stories' },
        { key: 'quotes', label: 'JSE quotes table' },
        { key: 'summary', label: 'Market Summary' },
        { key: 'watchlist', label: 'Your Watchlist' },
        { key: 'top-stocks', label: "Today's Top Stocks" },
        { key: 'news', label: "Today's Financial News" },
    ],
};

// Sectors a JSE stock can be filed under (the Local Market Overview tabs group these)
export const LOCAL_SECTORS = [...new Set(LOCAL_STOCKS.map((s) => s.sector))];
