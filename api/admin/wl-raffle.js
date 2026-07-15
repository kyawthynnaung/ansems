const crypto = require("crypto");
const { assertAdmin, json, supabaseFetch } = require("../_supabase");

const shuffle = (items) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
};

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return json(response, 405, { error: "Method not allowed." });
  }

  const authError = assertAdmin(request);
  if (authError) {
    return json(response, authError === "Unauthorized." ? 401 : 500, { error: authError });
  }

  const winnerCount = Number.parseInt(request.body?.winnerCount, 10);
  if (!Number.isInteger(winnerCount) || winnerCount < 1 || winnerCount > 2999) {
    return json(response, 400, { error: "Enter a valid winner count." });
  }

  try {
    const entriesResponse = await supabaseFetch(
      "wl_entries?select=id,x_username,wallet_address,comment_link,created_at&order=created_at.asc"
    );
    const winnersResponse = await supabaseFetch("wl_winners?select=entry_id");

    if (!entriesResponse.ok || !winnersResponse.ok) {
      return json(response, 500, { error: "Could not load raffle pool." });
    }

    const entries = await entriesResponse.json();
    const existingWinners = await winnersResponse.json();
    const existingWinnerIds = new Set(existingWinners.map((winner) => winner.entry_id));
    const eligibleEntries = entries.filter((entry) => !existingWinnerIds.has(entry.id));

    if (eligibleEntries.length === 0) {
      return json(response, 400, { error: "There are no eligible entries left to raffle." });
    }

    const selectedEntries = shuffle(eligibleEntries).slice(0, Math.min(winnerCount, eligibleEntries.length));
    const seed = crypto.randomBytes(16).toString("hex");

    const raffleResponse = await supabaseFetch("wl_raffles", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ winner_count: selectedEntries.length, seed }),
    });

    if (!raffleResponse.ok) {
      const detail = await raffleResponse.text();
      return json(response, 500, { error: "Could not create raffle record.", detail });
    }

    const [raffle] = await raffleResponse.json();
    const winnerPayload = selectedEntries.map((entry) => ({
      raffle_id: raffle.id,
      entry_id: entry.id,
      x_username: entry.x_username,
      wallet_address: entry.wallet_address,
      comment_link: entry.comment_link,
    }));

    const insertWinnersResponse = await supabaseFetch("wl_winners", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(winnerPayload),
    });

    if (!insertWinnersResponse.ok) {
      const detail = await insertWinnersResponse.text();
      return json(response, 500, { error: "Could not save raffle winners.", detail });
    }

    const winners = await insertWinnersResponse.json();
    return json(response, 200, {
      raffle,
      winners,
      totals: {
        entries: entries.length,
        eligibleBeforeDraw: eligibleEntries.length,
        selected: winners.length,
      },
    });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
};
