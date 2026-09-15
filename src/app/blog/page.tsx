import Link from "next/link";
import moment from "moment";
import Reveal from "@/components/Reveal";
import { getSortedPosts } from "@/lib/blogs";

export default function Blog() {
  const posts = getSortedPosts();

  return (
    <section className="writing-index">
      <header className="writing-index-header">
        <h1>writing</h1>
        <p>notes on software, products and things i keep thinking about.</p>
      </header>

      <ol className="writing-list">
        {posts.map((post, index) => (
          <li key={post.id}>
            <Reveal delay={Math.min(index * 0.05, 0.3)}>
              <Link
                className="writing-item"
                href={`/blog/${post.slug || post.id}`}
              >
                <div className="writing-item-topline">
                  <h2>{post.title}</h2>
                  <time dateTime={post.date}>
                    {moment(post.date, "MM-DD-YYYY").format("MMM YYYY")}
                  </time>
                </div>
                {post.description && <p>{post.description}</p>}
              </Link>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
