"use client";
import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addToWatchlist, removeFromWatchlist } from "@/lib/actions/watchlist.actions";

const WatchlistButton = ({
  symbol,
  company,
  isInWatchlist,
  market = "global",
  showTrashIcon = false,
  type = "button",
  onWatchlistChange,
}: WatchlistButtonProps) => {
  const router = useRouter();
  const [added, setAdded] = useState<boolean>(!!isInWatchlist);
  const [isPending, startTransition] = useTransition();

  const label = useMemo(() => {
    if (type === "icon") return added ? "" : "";
    return added ? "Remove from Watchlist" : "Add to Watchlist";
  }, [added, type]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const next = !added;
    // Optimistic toggle, rolled back if the server action fails
    setAdded(next);

    startTransition(async () => {
      const result = next ? await addToWatchlist(symbol, company, market) : await removeFromWatchlist(symbol, market);

      if (!result.success) {
        setAdded(!next);
        toast.error(result.error ?? "Failed to update watchlist");
        return;
      }

      toast.success(next ? `${symbol} added to your watchlist` : `${symbol} removed from your watchlist`);
      onWatchlistChange?.(symbol, next);
      router.refresh();
    });
  };

  if (type === "icon") {
    return (
      <button
        type="button"
        title={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-label={added ? `Remove ${symbol} from watchlist` : `Add ${symbol} to watchlist`}
        aria-pressed={added}
        disabled={isPending}
        className={`watchlist-icon-btn ${added ? "watchlist-icon-added" : ""}`}
        onClick={handleClick}
      >
        <span className="watchlist-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill={added ? "#FACC15" : "none"}
            stroke={added ? "#FACC15" : "currentColor"}
            strokeWidth="1.5"
            className="star-icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.385a.563.563 0 00-.182-.557L3.04 10.385a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z"
            />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      className={`watchlist-btn flex items-center justify-center ${added ? "watchlist-remove" : ""}`}
      onClick={handleClick}
    >
      {showTrashIcon && added ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-5 h-5 mr-2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 4v6m4-6v6m4-6v6" />
        </svg>
      ) : null}
      <span>{label}</span>
    </button>
  );
};

export default WatchlistButton;
