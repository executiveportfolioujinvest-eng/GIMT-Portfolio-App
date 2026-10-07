import {formatTimeAgo} from "@/lib/utils";

type NewsListProps = {
    articles: MarketNewsArticle[];
    emptyText?: string;
    // 'chip' shows the related ticker (dashboard), 'readmore' a Read More pill (stock page)
    variant?: 'chip' | 'readmore';
};

// News rows with source, time, headline and thumbnail
const NewsList = ({ articles, emptyText = 'No news right now. Check back later.', variant = 'chip' }: NewsListProps) => {
    if (articles.length === 0) {
        return <p className="py-8 text-center text-gray-500">{emptyText}</p>;
    }

    return (
        <ul className="news-list">
            {articles.map((article) => (
                <li key={`${article.id}-${article.url}`}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="news-row">
                        <div className="min-w-0 flex-1">
                            <p className="news-meta">
                                <span className="truncate">{article.source}</span>
                                <span className="mx-2">&bull;</span>
                                <span className="shrink-0">{formatTimeAgo(article.datetime)}</span>
                            </p>
                            <h3 className="news-row-title">{article.headline}</h3>
                            {variant === 'readmore' ? (
                                <span className="news-chip">Read More</span>
                            ) : article.related && (
                                <span className="news-chip">{article.related.split(',')[0]}</span>
                            )}
                        </div>
                        {article.image && (
                            // eslint-disable-next-line @next/next/no-img-element -- news thumbnails come from arbitrary publisher hosts
                            <img src={article.image} alt="" loading="lazy" className="news-thumb" />
                        )}
                    </a>
                </li>
            ))}
        </ul>
    );
};

export default NewsList;
