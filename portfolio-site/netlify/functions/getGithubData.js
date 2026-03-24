const fetch = require("node-fetch");

exports.handler = async (event, context) => {
  const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;

  // LOG 1: Check if token exists
  if (!GITHUB_TOKEN) {
    console.error("❌ ERROR: GITHUB_ACCESS_TOKEN is missing from .env");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing Token" }),
    };
  }

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.cloak-preview+json",
  };

  try {
    const reposResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&type=owner",
      { headers },
    );
    const repos = await reposResponse.json();

    // LOG 2: Check if GitHub rejected the token
    if (repos.message === "Bad credentials") {
      console.error(
        "❌ ERROR: GitHub API returned 'Bad credentials'. Check your token.",
      );
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Invalid Token" }),
      };
    }

    const commitResponse = await fetch(
      "https://api.github.com/search/commits?q=author:singhishkar108",
      { headers },
    );
    const commitData = await commitResponse.json();

    const languageSet = new Set();
    const languagePromises = repos.map((repo) =>
      fetch(repo.languages_url, { headers }).then((res) => res.json()),
    );

    const languagesResults = await Promise.all(languagePromises);
    languagesResults.forEach((langObj) => {
      if (langObj && typeof langObj === "object") {
        Object.keys(langObj).forEach((lang) => languageSet.add(lang));
      }
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectCount: Array.isArray(repos) ? repos.length : 0,
        commitCount: commitData.total_count || 0,
        languageCount: languageSet.size,
        recentProjects: Array.isArray(repos) ? repos.slice(0, 6) : [],
      }),
    };
  } catch (error) {
    console.error("❌ FUNCTION CRASH:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
