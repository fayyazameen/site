export type PostSource = "original" | "medium";

export type PostItem = {
  id: string;
  title: string;
  date: string;
  dateTime: string;
  time?: string;
  source: PostSource;
  category: string;
  description?: string;
  slug?: string;
};
