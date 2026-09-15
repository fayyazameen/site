import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 | fayyaz ameen",
  description: "this page does not exist",
};

const NotFound = () => (
  <section className="writing-index">
    <header className="writing-index-header">
      <h1>404</h1>
      <p>the page you are looking for does not exist.</p>
    </header>
    <div className="site-copy">
      <p>
        <Link href="/">back home</Link>
      </p>
    </div>
  </section>
);

export default NotFound;
