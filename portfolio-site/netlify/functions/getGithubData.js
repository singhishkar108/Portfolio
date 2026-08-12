const fetch = require("node-fetch");

// Helper function to build dynamic CORS headers
function getCorsHeaders(event) {
  const origin = event.headers.origin || event.headers.referer || "";

  // Trusted origins
  const isAllowed =
    origin.startsWith("https://singhishkar108.netlify.app") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.endsWith(".netlify.app");

  return {
    "Access-Control-Allow-Origin": isAllowed
      ? origin.replace(/\/$/, "")
      : "https://singhishkar108.netlify.app",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    Vary: "Origin",
  };
}

exports.handler = async (event, context) => {
  const corsHeaders = getCorsHeaders(event);

  // 1. Handle HTTP OPTIONS Preflight Request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: "",
    };
  }

  // 2. Only allow HTTP GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        Allow: "GET, OPTIONS",
      },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // 3. Validate Origin / Referer
  const origin = event.headers.origin || event.headers.referer || "";
  const allowedHost = event.headers.host;
  if (
    origin &&
    allowedHost &&
    !origin.includes(allowedHost) &&
    !origin.includes("localhost") &&
    !origin.includes("127.0.0.1")
  ) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Forbidden request source." }),
    };
  }

  const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  if (!GITHUB_TOKEN) {
    console.error(
      "❌ ERROR: GITHUB_ACCESS_TOKEN is missing from environment variables.",
    );
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server configuration error." }),
    };
  }

  const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Netlify-Portfolio-App",
  };

  try {
    // 4. Fetch user repositories
    const reposResponse = await fetch(
      "https://api.github.com/user/repos?per_page=100&type=owner&sort=updated",
      { headers },
    );

    if (reposResponse.status === 401) {
      return {
        statusCode: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid GitHub Token." }),
      };
    }

    if (!reposResponse.ok) {
      throw new Error(
        `GitHub Repos API responded with status ${reposResponse.status}`,
      );
    }

    const repos = await reposResponse.json();

    // 5. Fetch commit count safely
    let totalCommits = 0;
    try {
      const globalCommitsResponse = await fetch(
        "https://api.github.com/search/commits?q=author:singhishkar108+is:public,private",
        { headers },
      );
      if (globalCommitsResponse.ok) {
        const globalCommitsData = await globalCommitsResponse.json();
        totalCommits = globalCommitsData.total_count || 0;
      }
    } catch (err) {
      console.warn(
        "⚠️ Commit search rate-limited or unavailable, falling back to 0.",
      );
    }

    // 6. Process repository languages & commit stats
    const detailedRepos = await Promise.all(
      repos.map(async (repo) => {
        let allLanguages = [];
        let repoCommitCount = 0;

        // Fetch languages
        try {
          const langRes = await fetch(repo.languages_url, { headers });
          if (langRes.ok) {
            const languages = await langRes.json();
            allLanguages = Object.keys(languages);
          }
        } catch (e) {
          allLanguages = repo.language ? [repo.language] : [];
        }

        // Fetch activity stats
        try {
          const statsRes = await fetch(`${repo.url}/stats/participation`, {
            headers,
          });
          if (statsRes.ok) {
            const stats = await statsRes.json();
            if (stats && Array.isArray(stats.all)) {
              repoCommitCount = stats.all.reduce((a, b) => a + b, 0);
            }
          }
        } catch (e) {
          repoCommitCount = 0;
        }

        return {
          id: repo.id,
          name: repo.name,
          description: repo.description,
          html_url: repo.html_url,
          homepage: repo.homepage,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          isFork: repo.fork,
          isPrivate: repo.private,
          isArchived: repo.archived,
          updated_at: repo.updated_at,
          language: repo.language,
          all_languages: allLanguages,
          commit_count: repoCommitCount,
        };
      }),
    );

    // 7. Filter metrics
    const allLanguages = [
      ...new Set(detailedRepos.flatMap((r) => r.all_languages)),
    ].sort();
    const globalProjectCount = detailedRepos.filter((r) => !r.isFork).length;
    const publicDisplayProjects = detailedRepos.filter(
      (r) => !r.isPrivate && !r.isArchived,
    );

    // 8. Return payload with CORS and Caching Headers
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
      body: JSON.stringify({
        projectCount: globalProjectCount,
        commitCount: totalCommits,
        languageCount: allLanguages.length,
        allLanguages: allLanguages,
        projects: publicDisplayProjects,
      }),
    };
  } catch (error) {
    console.error("❌ FUNCTION ERROR:", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Failed to retrieve GitHub repository data.",
      }),
    };
  }
};
