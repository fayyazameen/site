import Reveal from "@/components/Reveal";
import { projects } from "@/data/projects";

export default function Projects() {
  return (
    <section className="projects-page">
      <header className="portfolio-header">
        <h1>Projects</h1>
        <p>Things I&apos;ve built to learn, explore or solve a problem.</p>
      </header>

      <div className="site-copy">
        {projects.map((project, index) => (
          <Reveal delay={Math.min(index * 0.05, 0.3)} key={project.title}>
            <p>
              <a href={project.link}>{project.title}</a>
              <br />
              <span className="site-muted">{project.description}</span>
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
