import Image from "next/image";
import {cn} from "@/lib/utils";

// Company logo from Finnhub, or a lettered tile when none is available (e.g. JSE stocks)
const StockLogo = ({ logo, symbol, company, size = 40, className }: { logo?: string; symbol: string; company?: string; size?: number; className?: string }) => {
    if (logo) {
        return (
            <Image
                src={logo}
                alt={`${company || symbol} logo`}
                width={size}
                height={size}
                className={cn("shrink-0 rounded-md bg-white object-contain p-1", className)}
                style={{ width: size, height: size }}
            />
        );
    }

    return (
        <span
            className={cn("flex shrink-0 items-center justify-center rounded-md bg-blue-500 font-semibold text-white", className)}
            style={{ width: size, height: size, fontSize: size * 0.32 }}
            aria-hidden="true"
        >
            {symbol.replace(/^\^/, '').slice(0, 3)}
        </span>
    );
};

export default StockLogo;
