import Link from "next/link";
import Avatar from "./Avatar";

export default function FeedItem({ name, driverId, tag, tagClass = "warn", quote, meta, when, extra }) {
  return (
    <div className="feed-item">
      <Avatar name={name} size={34} />
      <div className="body">
        <div className="line1">
          {driverId ? (
            <Link href={`/drivers/${encodeURIComponent(driverId)}`} className="nm">{name}</Link>
          ) : (
            <span className="nm">{name}</span>
          )}
          <span className={`chip ${tagClass}`}>{tag}</span>
          {extra}
        </div>
        {quote && <div className="quote">{quote}</div>}
        <div className="meta">{meta}</div>
      </div>
      <span className="when">{when}</span>
    </div>
  );
}
