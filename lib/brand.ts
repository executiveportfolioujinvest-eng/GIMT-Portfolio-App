import {isAdminRole, isOversightRole, type Department} from "@/lib/markets";

// The platform's three identities: each department's team, and UJ Invest above both for the
// President, Vice President and administrators
export type TeamBrand = 'gmit' | 'lmit' | 'ujinvest';

type BrandInfo = {
    team: string;
    teamName: string;
    // PNG header logo for emails (Gmail and Outlook don't show SVG), and the width it's shown at
    emailLogo: { src: string; width: number };
};

export const BRANDS: Record<TeamBrand, BrandInfo> = {
    gmit: { team: 'GMIT', teamName: 'Global Markets Investment Team (GMIT)', emailLogo: { src: '/assets/images/logo-portfolio.png', width: 190 } },
    lmit: { team: 'LMIT', teamName: 'Local Markets Investment Team (LMIT)', emailLogo: { src: '/assets/images/lmit-logo-portfolio.png', width: 184 } },
    ujinvest: { team: 'UJ Invest', teamName: 'UJ Invest Portfolio Management (GMIT and LMIT)', emailLogo: { src: '/assets/images/ujinvest-logo-email.png', width: 57 } },
};

export const brandFor = ({ department, teamRole }: { department?: Department | string | null; teamRole?: string | null }): TeamBrand => {
    if (department === 'both' || isOversightRole(teamRole) || isAdminRole(teamRole)) return 'ujinvest';
    return department === 'local' ? 'lmit' : 'gmit';
};
