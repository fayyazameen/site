import Link from "next/link";
import {
  PiEnvelopeSimple,
  PiGithubLogo,
  PiLinkedinLogo,
  PiX,
} from "react-icons/pi";
import Magnetic from "@/components/Magnetic";
import NameReveal from "@/components/NameReveal";
import { LinkPreview } from "@/components/ui/LinkPreview";
import type { PostItem } from "@/types";

type HomePageProps = {
  posts: PostItem[];
};

const HomePage = ({ posts }: HomePageProps) => {
  const recentPosts = posts.slice(0, 3);

  return (
    <div className="home-layout">
      <section className="home-main">
        <header className="portfolio-header">
          <p className="portfolio-greeting">hello, hola, مرحباً</p>
          <NameReveal text="fayyaz ameen" />
          <p className="portfolio-role">
            your role at <a href="https://example.com">your company</a>
          </p>
        </header>

        <div className="site-copy home-intro">
          <p>
            this is a placeholder intro. replace it with one sentence about
            what you do and what you care about.
          </p>

          <details className="bio-details">
            <summary>
              <span className="more-label">read more</span>
              <span className="less-label">read less</span>
            </summary>
            <div className="bio-more">
              <p>
                everything in this section is placeholder copy. use one short
                paragraph per chapter of your story, most recent first.
              </p>
              <p>
                links can show a live preview on hover, like{" "}
                <LinkPreview url="https://github.com">github</LinkPreview>.
                use them when you mention companies or projects.
              </p>
            </div>
          </details>

          <div className="investing-note">
            <p className="investing-label">placeholder section</p>
            <p>
              use this bordered block for a callout you want people to see,
              like investing, hiring or collaborations.{" "}
              <a href="mailto:fayyameen@gmail.com">email me</a>.
            </p>
          </div>

          <p className="projects-note">
            oh, and i also build{" "}
            <Link href="/projects">projects from scratch</Link>.
          </p>
        </div>

        <nav className="social-links" aria-label="contact links">
          <Magnetic>
            <a
              href="https://x.com/fayyaza"
              aria-label="fayyaz on x"
              title="x"
            >
              <PiX aria-hidden="true" />
            </a>
          </Magnetic>
          <Magnetic>
            <a
              href="https://github.com/yourusername"
              aria-label="fayyaz on github"
              title="github"
            >
              <PiGithubLogo aria-hidden="true" />
            </a>
          </Magnetic>
          <Magnetic>
            <a
              href="https://www.linkedin.com/in/fayyazameen/"
              aria-label="fayyaz on linkedin"
              title="linkedin"
            >
              <PiLinkedinLogo aria-hidden="true" />
            </a>
          </Magnetic>
          <Magnetic>
            <a
              href="mailto:fayyameen@gmail.com"
              aria-label="email fayyaz"
              title="email"
            >
              <PiEnvelopeSimple aria-hidden="true" />
            </a>
          </Magnetic>
        </nav>
      </section>

      {recentPosts.length > 0 && (
        <aside className="writing-rail">
          <p className="writing-label">i write occasionally</p>
          <ul>
            {recentPosts.map((post) => (
              <li key={post.id}>
                <Link href={`/blog/${post.slug || post.id}`}>{post.title}</Link>
              </li>
            ))}
          </ul>
          <Link className="writing-all" href="/blog">
            all writing →
          </Link>
        </aside>
      )}

    </div>
  );
};

export default HomePage;
