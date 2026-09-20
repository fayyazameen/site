import fs from "fs";
import matter from "gray-matter";
import path from "path";
import moment from "moment";
import { remark } from "remark";
import html from "remark-html";

import type { PostItem } from "@/types";
import { getPublicationDetails } from "./post-publication";

const postsDirectory = path.join(process.cwd(), "src", "content", "blog");

export const removeDashes = (value: string = "") =>
  value
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/([\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, "$1 ")
    .replace(/\s+-\s+/g, ", ");

const removeDashesFromHtml = (value: string) =>
  value.replace(
    /(^|>)([^<]+)(?=<|$)/g,
    (_, opening, text) => `${opening}${removeDashes(text)}`,
  );

const getSortedPosts = (): PostItem[] => {
  const fileNames = fs
    .readdirSync(postsDirectory)
    .filter((name) => name.endsWith(".md"));

  const allPostsData = fileNames.map((fileName) => {
    const id = fileName.replace(/\.md$/, "");

    const fullPath = path.join(postsDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, "utf8");

    const matterResult = matter(fileContents);

    // Extract description from content if not in frontmatter
    let description = matterResult.data.description;
    if (!description) {
      const content = matterResult.content;
      // Simple extraction of first paragraph or first 200 chars
      const firstParagraph = content
        .split("\n\n")[0]
        .replace(/^#+\s.*$/gm, "")
        .trim(); // Remove headers
      description =
        firstParagraph.length > 0 ? firstParagraph.slice(0, 160) + "..." : "";
    }

    return {
      id,
      slug: id,
      title: removeDashes(matterResult.data.title),
      date: matterResult.data.date,
      ...getPublicationDetails(
        matterResult.data.date,
        matterResult.data.time,
        matterResult.data.source,
      ),
      category: removeDashes(matterResult.data.category),
      description: removeDashes(description),
    };
  });

  return allPostsData.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
};

export const getCategorizedPosts = (): Record<string, PostItem[]> => {
  const sortedPosts = getSortedPosts();
  const categorizedPosts: Record<string, PostItem[]> = {};

  sortedPosts.forEach((post) => {
    if (!categorizedPosts[post.category]) {
      categorizedPosts[post.category] = [];
    }
    categorizedPosts[post.category].push(post);
  });
  return categorizedPosts;
};

export const getPostData = async (id: string) => {
  const fullPath = path.join(postsDirectory, `${id}.md`);

  const fileContents = fs.readFileSync(fullPath, "utf8");

  const matterResult = matter(fileContents);

  const processedContent = await remark()
    .use(html)
    .process(matterResult.content);

  const contentHtml = removeDashesFromHtml(processedContent.toString());
  const wordCount = matterResult.content
    .replace(/[#*_>`\[\]()!]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return {
    id,
    contentHtml,
    title: removeDashes(matterResult.data.title),
    category: removeDashes(matterResult.data.category),
    description: removeDashes(matterResult.data.description || ""),
    date: moment
      .utc(matterResult.data.date, "MM-DD-YYYY", true)
      .format("MMMM D, YYYY"),
    ...getPublicationDetails(
      matterResult.data.date,
      matterResult.data.time,
      matterResult.data.source,
    ),
    readTime: Math.max(1, Math.ceil(wordCount / 220)),
  };
};

export { getSortedPosts };
