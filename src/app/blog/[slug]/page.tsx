import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostData, getSortedPosts } from "@/lib/blogs";
import PostSourceLabel from "@/components/PostSourceLabel";

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
          <time dateTime={post.dateTime}>
            {post.date}
            {post.time && (
              <>
                <span aria-hidden="true"> · </span>
                {post.time}
              </>
            )}
          </time>
          <span>{post.readTime} min read</span>
          <PostSourceLabel source={post.source} />
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
