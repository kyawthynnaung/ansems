const crypto = require("crypto");
const { assertAdmin, json, supabaseFetch } = require("../_supabase");

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const authError = assertAdmin(request);
  if (authError) {
    return json(response, authError === "Unauthorized." ? 401 : 500, { error: authError });
  }

  const entryId = request.body?.entryId;
  if (!isUuid(entryId)) {
    return json(response, 400, { error: "Choose a valid WL entry." });
  }

  try {
    const existingWinnerResponse = await supabaseFetch(`wl_winners?select=id&entry_id=eq.${entryId}&limit=1`);
    if (!existingWinnerResponse.ok) {
      return json(response, 500, { error: "Could not check winner status." });
    }

    const existingWinners = await existingWinnerResponse.json();
    if (existingWinners.length > 0) {
      return json(response, 409, { error: "This entry is already in final WL." });
    }

    const entryResponse = await supabaseFetch(
      `wl_entries?select=id,x_username,wallet_address,comment_link&id=eq.${entryId}&limit=1`
    );

    if (!entryResponse.ok) {
      return json(response, 500, { error: "Could not load WL entry." });
    }

    const [entry] = await entryResponse.json();
    if (!entry) {
      return json(response, 404, { error: "WL entry not found." });
    }

    const raffleResponse = await supabaseFetch("wl_raffles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        winner_count: 1,
        seed: `manual:${crypto.randomBytes(16).toString("hex")}`,
      }),
    });

    if (!raffleResponse.ok) {
      return json(response, 500, { error: "Could not create manual WL record." });
    }

    const [raffle] = await raffleResponse.json();
    const winnerResponse = await supabaseFetch("wl_winners", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        raffle_id: raffle.id,
        entry_id: entry.id,
        x_username: entry.x_username,
        wallet_address: entry.wallet_address,
        comment_link: entry.comment_link,
      }),
    });

    if (!winnerResponse.ok) {
      return json(response, 500, { error: "Could not save manual WL winner." });
    }

    const [winner] = await winnerResponse.json();
    return json(response, 200, { raffle, winner });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
};
