const planStore = require("../services/planStore");

/**
 * GET /api/plans?product=notebook   →  { product, plans: [...] }
 *
 * The subscription tiers for one product. The mobile app asks for "notebook";
 * the web canvas asks for "canvas". Public: prices are not a secret, and the
 * paywall needs them before a session exists.
 */
exports.list = async (req, res) => {
  try {
    const product = req.query.product === planStore.CANVAS ? planStore.CANVAS : planStore.NOTEBOOK;

    // The cache is filled at boot; if that failed, try once more here rather
    // than serving an empty list.
    if (!planStore.loaded()) await planStore.init();

    res.json({
      product,
      plans: planStore.list(product).map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        priceYear: p.priceYear,
        monthly: p.monthly,
        daily: p.daily,
        features: p.features,
        popular: p.popular,
      })),
    });
  } catch (err) {
    console.error("plans list error:", err.message);
    res.status(500).json({ error: "Could not load the plans." });
  }
};

/**
 * POST /api/plans/reload  (admin) — picks up plan edits made straight in the
 * database without restarting the server.
 */
exports.reload = async (req, res) => {
  try {
    const count = await planStore.reload();
    res.json({ ok: true, plans: count });
  } catch (err) {
    console.error("plans reload error:", err.message);
    res.status(500).json({ error: "Could not reload the plans." });
  }
};
