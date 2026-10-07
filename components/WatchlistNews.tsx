import {formatTimeAgo} from "@/lib/utils";

const WatchlistNews = ({ news }: WatchlistNewsProps) => {
    if (!news || news.length === 0) {
        return <p className="text-gray-500">No news for your watchlist right now. Check back later.</p>;
    }

    return (
        <div className="watchlist-news">
            {news.map((article) => (
                <a
                    key={`${article.id}-${article.url}`}
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-item flex flex-col"
                >
                    {article.related && <span className="news-tag">{article.related}</span>}
                    <h3 className="news-title">{article.headline}</h3>
                    <div className="news-meta">
                        <span>{article.source}</span>
                        <span className="mx-2">&bull;</span>
                        <span>{formatTimeAgo(article.datetime)}</span>
                    </div>
                    <p className="news-summary">{article.summary}</p>
                    <span className="news-cta mt-auto">Read More &rarr;</span>
                </a>
            ))}
        </div>
    );
};

export default WatchlistNews;
