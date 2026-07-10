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
    // 1. Fetch ALL repositories (including private and archived) where you are the owner
    // "type=owner" combined with authorization token automatically yields private repos too
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

    // 2. Fetch global commit stats for the top-level stats bar (includes public & private)
    const globalCommitsResponse = await fetch(
      "https://api.github.com/search/commits?q=author:singhishkar108+is:public,private",
      { headers },
    );
    const globalCommitsData = await globalCommitsResponse.json();

    // 3. Process each repository to get detailed languages and commit counts
    const detailedRepos = await Promise.all(
      repos.map(async (repo) => {
        // Fetch specific languages for this repo
        const langRes = await fetch(repo.languages_url, { headers });
        const languages = await langRes.json();

        // Fetch commit activity (participation)
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
          isPrivate: repo.private, // Track privacy
          isArchived: repo.archived, // Track archive status
          updated_at: repo.updated_at,
          language: repo.language,
          all_languages: Object.keys(languages),
          commit_count: totalCommits,
        };
      }),
    );

    // 4. Create a unique list of all languages across ALL items (including private/archived)
    const allLanguages = [
      ...new Set(detailedRepos.flatMap((r) => r.all_languages)),
    ].sort();

    // 5. Separate data: stats bar counts everything, grid gets ONLY public + non-archived
    const globalProjectCount = detailedRepos.filter((r) => !r.isFork).length;
    const publicDisplayProjects = detailedRepos.filter(
      (r) => !r.isPrivate && !r.isArchived,
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectCount: globalProjectCount, // Private + Public count
        commitCount: globalCommitsData.total_count || 0,
        languageCount: allLanguages.length, // Complete cross-repo languages count
        allLanguages: allLanguages,
        projects: publicDisplayProjects, // Kept explicitly to clean public display repos
      }),
    };
  } catch (error) {
    console.error("❌ FUNCTION CRASH:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
