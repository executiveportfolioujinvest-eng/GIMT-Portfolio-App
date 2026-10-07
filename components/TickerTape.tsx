"use client";

import { useEffect, useRef } from "react";

const TICKER_SYMBOLS =
    "FOREXCOM:SPXUSD,FOREXCOM:NSXUSD,FX_IDC:ZARUSD,FOREXCOM:DJI,FX:EURUSD,BITSTAMP:BTCUSD,CMCMARKETS:GOLD";

const TickerTape = () => {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Avoid injecting the module script twice if this mounts more than once
        const existingScript = document.querySelector(
            'script[src="https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js"]'
        );

        if (!existingScript) {
            const script = document.createElement("script");
            script.type = "module";
            script.src = "https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js";
            document.body.appendChild(script);
        }
    }, []);

    return (
        <div ref={containerRef} className="ticker-tape-wrapper w-full">
            {/* @ts-expect-error -- custom element not in JSX.IntrinsicElements */}
            <tv-ticker-tape symbols={TICKER_SYMBOLS} colorTheme="dark"></tv-ticker-tape>
        </div>
    );
};

export default TickerTape;