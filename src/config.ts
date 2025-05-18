export const SITE = {
  website: "https://tmokmss.github.io", // replace this with your deployed domain
  base: 'blog/',
  author: "Masashi Tomooka",
  profile: "https://github.com/tmokmss",
  desc: "A tech blog from a Cloud enthusiast.",
  title: "tmokmss/blog",
  ogImage: "astropaper-og.jpg",
  lightAndDarkMode: true,
  postPerIndex: 5,
  postPerPage: 5,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: false,
  showBackButton: false, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Suggest Changes",
    url: "https://github.com/tmokmss/blog/edit/main/",
  },
  dynamicOgImage: true,
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Tokyo", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;
