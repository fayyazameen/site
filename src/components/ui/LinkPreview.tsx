"use client";

import * as HoverCard from "@radix-ui/react-hover-card";
import Image from "next/image";
import { encode } from "qss";
import type { ReactNode } from "react";

type LinkPreviewProps = {
  children: ReactNode;
  url: string;
};

export const LinkPreview = ({ children, url }: LinkPreviewProps) => {
  const isExternal = /^https?:\/\//.test(url);
  const absoluteUrl = new URL(url, "https://your-domain.com").toString();
  const domain = new URL(absoluteUrl).hostname.replace(/^www\./, "");
  const src = `https://api.microlink.io/?${encode({
    url: absoluteUrl,
    screenshot: true,
    meta: false,
    embed: "screenshot.url",
    colorScheme: "dark",
    "viewport.isMobile": false,
    "viewport.deviceScaleFactor": 1,
    "viewport.width": 1200,
    "viewport.height": 750,
  })}`;

  return (
    <HoverCard.Root openDelay={140} closeDelay={80}>
      <HoverCard.Trigger
        href={url}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        className="company-link"
      >
        {children}
      </HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          className="company-preview"
          side="right"
          align="center"
          sideOffset={14}
          collisionPadding={18}
        >
          <div className="company-preview-image">
            <Image
              src={src}
              width={288}
              height={180}
              quality={72}
              alt={`${children} website preview`}
            />
          </div>
          <span>{domain}</span>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
};
