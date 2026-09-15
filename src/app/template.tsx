import { type ReactNode } from "react";

const Template = ({ children }: { children: ReactNode }) => {
  return <div className="route-enter">{children}</div>;
};

export default Template;
