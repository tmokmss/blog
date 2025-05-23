# Instructions for AI agents
This is a repository that generates static content of a tech blog featuring technologies such as AWS, GenAI, serverless, etc.

It uses Astro to generate the assets, and GitHub Pages to serve them.

## How to add an article

You can add a blog article with the following steps:

1. Fork and clone the repo and create a new git branch.
2. Create a sub-directory in `src/data/blog`. The directory name should include the publication date and a brief title (kebab-cased).
3. In the directory, create `index.md`. The file should contain metadata in the below schema:

```
---
author: Masashi Tomooka
pubDatetime: 2025-05-18T08:00:00Z
title: Introducing Remote SWE Agents, a cloud based coding AI agent
slug: introducing-remote-swe-agents
featured: true
draft: false
tags:
  - GenAI
  - AWS
description:
  Self-host AI SWE agents with Devin or Codex like experience in your AWS account.
---
```

4. After the metadata, write the article in markdown format. You can also attach images with `![alt text](./images/sample.png)'` notation. Create image files in the same directory as `index.md`.
5. After finished writing the article, submit a GitHub Pull Request. Use English for both PR title and description. Also, please attach the preview image of the article (screenshot of a browser screen) in the PR (DO NOT commit the screenshot!). To get the screenshot, see the next section.
6. Make sure the CI status of the PR passing.

## How to preview the article

You can run Astro dev server locally to preview the article in the actual browser environment. To run the server, run the following command:

```sh
# Install pnpm
npm i -g pnpm@9
# Install project dependencies
pnpm install
# Start running the project
pnpm run dev
```

And then you can open `http://localhost:4321/blog/` to access the preview page.

## Things to consider when you write/translate an article

* The markdown code block("```") should prefix the code type for syntax highlight. (e.g. js, ts, py, dockerfile, etc.)
* Image block should contain alt text (e.g. `![image description](./images/foo.png)`.)
* When using footnote, Add notation like `[^1]` to where you want to add a note, and add `[^1]: bla bla` at the final part of the markdown.
* When you translate an existing article, ALWAYS download the original image via url. DO NOT use screenshot; it makes the image quality bad.
* When getting the content of `hatenablog.com`, you should use the fetch tool instead of playwright (browser) tools, because fetch is more efficient.
