import {serve} from "inngest/next";
import {inngest} from "@/lib/inngest/client";
import {checkStockAlerts, collectCompanyFinancials, sendBirthdayEmails, sendDailyNewsSummary, sendPortfolioInsider, sendSignUpEmail} from "@/lib/inngest/functions";

// Collection steps read results documents with Gemini, which can take most of a minute
export const maxDuration = 60;

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendDailyNewsSummary, sendPortfolioInsider, checkStockAlerts, sendBirthdayEmails, collectCompanyFinancials],
})
