import { joinPaths } from "node_modules/astro/dist/core/path";

/**
 * Get full path of a blog post using only the frontmatter slug
 * @param id - id of the blog post (aka slug)
 * @param includeBase - whether to include `/posts` in return value
 * @returns blog post path
 */
export function getPath(id: string, includeBase = true) {
  const basePath = includeBase
    ? joinPaths(import.meta.env.BASE_URL, "posts")
    : "";

  // Making sure `id` does not contain the directory
  const blogId = id.split("/");
  const slug = blogId.length > 0 ? blogId.slice(-1) : blogId;

  // Use only the slug, ignoring directory structure
  return [basePath, slug].join("/") + "/";
}
