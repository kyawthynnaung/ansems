const { assertAdmin, json, supabaseFetch } = require("../_supabase");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return json(response, 405, { error: "Method not allowed." });
  }

  const authError = assertAdmin(request);
  if (authError) {
    return json(response, authError === "Unauthorized." ? 401 : 500, { error: authError });
  }

  try {
    const entriesResponse = await supabaseFetch(
      "wl_entries?select=id,x_username,wallet_address,comment_link,liked_post,commented_post,reposted_post,confirmed,created_at&order=created_at.desc"
    );
    const winnersResponse = await supabaseFetch(
      "wl_winners?select=id,entry_id,x_username,wallet_address,comment_link,selected_at&order=selected_at.desc"
    );

    if (!entriesResponse.ok || !winnersResponse.ok) {
      return json(response, 500, { error: "Could not load WL data." });
    }

    const entries = await entriesResponse.json();
    const winners = await winnersResponse.json();
    const winnerEntryIds = new Set(winners.map((winner) => winner.entry_id));

    return json(response, 200, {
      entries,
      winners,
      totals: {
        entries: entries.length,
        winners: winners.length,
        eligible: entries.filter((entry) => !winnerEntryIds.has(entry.id)).length,
      },
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
};
