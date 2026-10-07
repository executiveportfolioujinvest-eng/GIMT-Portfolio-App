'use client';
import { useEffect, useRef } from 'react';
const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>,height = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if(!containerRef.current) return;
        if(containerRef.current.dataset.loaded) return;
        containerRef.current.innerHTML = `<div class="tradingview-widget-container__widget" style="width:100%; height: ${height}px;"></div> `;

        const script = document.createElement("script");
        script.src = scriptUrl;
        script.async = true;
        // TradingView needs absolute URLs for its click-through links (e.g. '/stocks' -> https://host/stocks)
        const resolvedConfig = Object.fromEntries(
            Object.entries(config).map(([key, value]) =>
                (key === 'largeChartUrl' || key === 'symbolUrl') && typeof value === 'string' && value.startsWith('/')
                    ? [key, `${window.location.origin}${value}`]
                    : [key, value]
            )
        );
        script.innerHTML = JSON.stringify(resolvedConfig);

        containerRef.current.appendChild(script);
        containerRef.current.dataset.loaded = 'true';

        return () => {
            if(containerRef.current) {
                containerRef.current.innerHTML = '';
                delete containerRef.current.dataset.loaded;
            }
        }
        }, [scriptUrl, config, height]);

    return containerRef;
}
export default useTradingViewWidget
