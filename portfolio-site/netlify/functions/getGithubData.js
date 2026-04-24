const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

  if (!GITHUB_TOKEN) {
    console.error("❌ ERROR: GITHUB_ACCESS_TOKEN is missing from .env");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Token" }),
    };
  }

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
  };

  try {
    // 1. Fetch all repositories (up to 100) where you are the owner
    const reposResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&type=owner&sort=updated",
      { headers },
    );
    const repos = await reposResponse.json();

    if (repos.message === "Bad credentials") {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid Token" }),
      };
    }

    // 2. Fetch global commit stats for the top-level stats bar
    const globalCommitsResponse = await fetch(
      "https://api.github.com/search/commits?q=author:singhishkar108",
      { headers },
    );
    const globalCommitsData = await globalCommitsResponse.json();

    // 3. Process each repository to get detailed languages and commit counts
    // We use Promise.all to fetch this data in parallel for speed
    const detailedRepos = await Promise.all(
      repos.map(async (repo) => {
        // Fetch specific languages for this repo
        const langRes = await fetch(repo.languages_url, { headers });
        const languages = await langRes.json();

        // Fetch commit activity (participation) to approximate commit count
        // GitHub API 'participation' returns weekly commit counts for the last year
        const statsRes = await fetch(`${repo.url}/stats/participation`, {
          headers,
        });
        const stats = await statsRes.json();
        const totalCommits = stats.all
          ? stats.all.reduce((a, b) => a + b, 0)
          : 0;

        return {
          id: repo.id,
          name: repo.name,
          description: repo.description,
          html_url: repo.html_url,
          homepage: repo.homepage,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          isFork: repo.fork,
          updated_at: repo.updated_at,
          language: repo.language, // Primary language
          all_languages: Object.keys(languages), // List of all languages used
          commit_count: totalCommits,
        };
      }),
    );

    // 4. Create a unique list of all languages across all repos for the filter dropdown
    const allLanguages = [
      ...new Set(detailedRepos.flatMap((r) => r.all_languages)),
    ].sort();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectCount: detailedRepos.filter((r) => !r.isFork).length,
        commitCount: globalCommitsData.total_count || 0,
        languageCount: allLanguages.length,
        allLanguages: allLanguages, // For the dropdown menu
        projects: detailedRepos, // The full list for the frontend to filter/sort
      }),
    };
  } catch (error) {
    console.error("❌ FUNCTION CRASH:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
