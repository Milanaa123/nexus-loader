module.exports = async function (req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const b = req.body || {};
    const q = req.query || {};
    const action = b.action || q.action;
    const key = process.env.NEXUS_API_KEY;
    if (!key)
      return res
        .status(500)
        .json({ ok: false, error: "NEXUS_API_KEY is not configured" });
    const game = String(b.game || q.game || "stardewvalley").replace(
      /[^a-z0-9_-]/gi,
      ""
    );
    const headers = { apikey: key, "User-Agent": "nexus-loader/5.2" };
    async function api(url) {
      const r = await fetch(url, { headers });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Nexus error");
      return d;
    }
    async function getMainFile(id) {
      const f = await api(
        `https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`
      );
      const files = f.files || [];
      return (
        files.find((x) => x.is_primary) ||
        files.find((x) => x.category_name === "MAIN") ||
        files[0]
      );
    }
    if (action === "validate") {
      const d = await api("https://api.nexusmods.com/v1/users/validate.json");
      return res.json({
        ok: true,
        data: { valid: true, isPremium: !!d.is_premium },
      });
    }
    if (action === "files") {
      const id = Number(b.modId || q.modId);
      if (!id)
        return res.status(400).json({ ok: false, error: "Invalid modId" });
      return res.json({
        ok: true,
        data: await api(
          `https://api.nexusmods.com/v1/games/${game}/mods/${id}/files.json`
        ),
      });
    }

    if (action === "resolveQueue") {
      const ids = b.modIds || b.queue || q.modIds || q.queue || [];
      const list = Array.isArray(ids)
        ? ids
        : String(ids)
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
      const result = [];
      for (const raw of list) {
        const id = Number(raw);
        if (!id) continue;
        const file = await getMainFile(id);
        if (file) {
          result.push({
            modId: id,
            fileId: file.file_id,
            name: file.name || "",
            version: file.version || "",
          });
        }
      }
      return res.json({
        ok: true,
        data: { queue: result, count: result.length },
      });
    }

    if (action === "download" || action === "proxyDownload") {
      const id = Number(b.modId || q.modId);
      if (!id)
        return res.status(400).json({ ok: false, error: "Invalid modId" });
      const file =
        Number(b.fileId || q.fileId) || (await getMainFile(id))?.file_id;
      if (!file)
        return res
          .status(404)
          .json({ ok: false, error: "No File found for mod: " + id });
      const d = await api(
        `https://api.nexusmods.com/v1/games/${game}/mods/${id}/files/${file}/download_link.json`
      );
      const link = d[0]?.URI || d[0]?.uri;
      if (!link) return res.status(502).json({ ok: false, error: "No mirror" });
      if (q.proxy === "true" || b.proxy === true) {
        const r = await fetch(link);
        if (!r.ok)
          return res.status(502).json({ ok: false, error: "Download failed" });
        res.setHeader(
          "Content-Type",
          r.headers.get("content-type") || "application/zip"
        );
        res.setHeader("Content-Disposition", 'attachment; filename="mod.zip"');
        return r.body.pipe(res);
      }
      res.writeHead(302, { Location: link });
      return res.end();
    }
    return res
      .status(400)
      .json({ ok: false, error: "Unknown action", received: action });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
};
