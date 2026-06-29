const fetch = require("node-fetch");

const DISCORD_APP_ID = "1520971934274158714";
const DISCORD_USER_ID = "520279853199523840";
const ANILIST_USERNAME = process.env.ANILIST_USERNAME || "JayGxnzalez";
const BOT_TOKEN = process.env.BOT_TOKEN;

async function fetchAniListData() {
  const query = `
    query ($name: String) {
      User(name: $name) {
        id
        name
        avatar { large }
        createdAt
        statistics {
          anime {
            count
            episodesWatched
            minutesWatched
            meanScore
            statuses(sort: COUNT_DESC) {
              status
              count
            }
          }
        }
      }
    }
  `;

  const activityQuery = `
    query ($name: String) {
      activities(userName: $name, sort: ID_DESC, perPage: 1) {
        ... on ListActivity {
          status
          progress
          media {
            title {
              userPreferred
            }
          }
        }
      }
    }
  `;

  const userRes = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { name: ANILIST_USERNAME } }),
  });

  const { data: userData } = await userRes.json();
  const user = userData.User;

  const activityRes = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: activityQuery, variables: { name: ANILIST_USERNAME } }),
  });

  const { data: activityData } = await activityRes.json();
  const latestActivity = activityData.activities?.[0] ?? null;

  return { user, latestActivity };
}

async function updateWidget() {
  console.log("Fetching AniList data...");
  const { user, latestActivity } = await fetchAniListData();

  const stats = user.statistics.anime;
  const watching = stats.statuses.find(s => s.status === "CURRENT")?.count ?? 0;
  const daysWatched = (stats.minutesWatched / 1440).toFixed(1);
  const joined = new Date(user.createdAt * 1000).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric"
  });

  let activityText = "No recent activity";
  if (latestActivity) {
    const status = latestActivity.status.charAt(0).toUpperCase() + latestActivity.status.slice(1);
    const progress = latestActivity.progress ? ` ${latestActivity.progress} of` : "";
    const title = latestActivity.media.title.userPreferred;
    activityText = `Latest Activity: ${status}${progress} ${title}`;
  }

  const body = {
    username: user.name,
    data: {
      dynamic: [
        { type: 3, name: "avatar", value: { url: user.avatar.large } },
        { type: 1, name: "username", value: user.name },
        { type: 1, name: "latest_activity", value: activityText },
        { type: 1, name: "total_anime", value: String(stats.count) },
        { type: 1, name: "days_watched", value: String(daysWatched) },
        { type: 1, name: "mean_score", value: Number(stats.meanScore).toFixed(1) },
        { type: 1, name: "episodes_watched", value: String(stats.episodesWatched) },
        { type: 1, name: "currently_watching", value: String(watching) },
        { type: 1, name: "joined", value: joined },
        { type: 1, name: "mini_stat", value: `Watched Anime: ${stats.count}` },
      ]
    }
  };

  const res = await fetch(
    `https://discord.com/api/v9/applications/${DISCORD_APP_ID}/users/${DISCORD_USER_ID}/identities/0/profile`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bot ${BOT_TOKEN}`,
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)"
      },
      body: JSON.stringify(body)
    }
  );

  const text = await res.text();
  console.log("Widget updated:", res.status, text);
}

updateWidget();
