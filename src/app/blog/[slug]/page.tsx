import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostData, getSortedPosts } from "@/lib/blogs";

export function generateStaticParams() {
  return getSortedPosts().map((post) => ({ slug: post.slug || post.id }));
}

const Post = async ({ params }: { params: { slug: string } }) => {
  let post;

  try {
    post = await getPostData(params.slug);
  } catch {
    notFound();
  }

  return (
    <article className="article-page">
      <header className="article-header">
        <h1>{post.title}</h1>
        {post.description && <p className="article-deck">{post.description}</p>}
        <div className="article-meta">
          {post.category && <span>{post.category}</span>}
          <time>{post.date}</time>
          <span>{post.readTime} min read</span>
        </div>
      </header>

      <div className="post">
        <div
          className="post-copy"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </div>

      <footer className="article-footer">
        <Link href="/blog">all writing</Link>
        <Link href="/">home</Link>
      </footer>
    </article>
  );
};

export default Post;
