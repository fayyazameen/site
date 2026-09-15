type NameRevealProps = {
  text: string;
};

const NameReveal = ({ text }: NameRevealProps) => (
  <h1 className="name-reveal" aria-label={text}>
    {Array.from(text).map((letter, index) => (
      <span
        aria-hidden="true"
        key={`${letter}-${index}`}
        style={{ animationDelay: `${90 + index * 28}ms` }}
      >
        {letter === " " ? " " : letter}
      </span>
    ))}
  </h1>
);

export default NameReveal;
