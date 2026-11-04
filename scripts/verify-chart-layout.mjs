import assert from "node:assert/strict";
import { build } from "esbuild";

const built = await build({
  entryPoints: ["src/shared/charts/chartViewport.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { chartGeometry, nearestChartIndex } = await import(
  "data:text/javascript;base64," +
    Buffer.from(built.outputFiles[0].text).toString("base64")
);

for (const width of [200, 248, 256, 302, 326, 420, 559]) {
  for (const dual of [false, true]) {
    const geometry = chartGeometry(width, dual);
    assert.equal(geometry.compact, true);
    assert.equal(
      geometry.width,
      width,
      "Phone charts use their real container width, not a horizontally scrolled desktop canvas",
    );
    assert.ok(
      geometry.start > 0 &&
        geometry.end < width &&
        geometry.end > geometry.start,
    );
    if (dual)
      assert.ok(
        geometry.width - geometry.end >= 48,
        "Right-axis compact labels have a dedicated gutter and stay end-anchored inside the SVG",
      );
    const bounds = { left: 24, width };
    assert.equal(
      nearestChartIndex(24 + geometry.start, bounds, geometry, 36),
      0,
    );
    assert.equal(
      nearestChartIndex(24 + geometry.end, bounds, geometry, 36),
      35,
    );
    assert.equal(nearestChartIndex(-100, bounds, geometry, 36), 0);
    assert.equal(nearestChartIndex(10000, bounds, geometry, 36), 35);
    assert.equal(
      nearestChartIndex(
        24 + (geometry.start + geometry.end) / 2,
        bounds,
        geometry,
        121,
      ),
      60,
    );
    assert.equal(nearestChartIndex(200, bounds, geometry, 1), 0);
    assert.equal(
      nearestChartIndex(200, { left: 0, width: 0 }, geometry, 36),
      0,
    );
  }
}
for (const width of [0, 560, 960, 1440])
  assert.equal(chartGeometry(width).compact, false);
const desktop = chartGeometry(960, true);
assert.equal(
  nearestChartIndex(
    45 + desktop.end / 2,
    { left: 45, width: 480 },
    desktop,
    36,
  ),
  35,
  "Pointer mapping respects scaled SVG coordinates",
);
console.log(
  "Chart layout checks passed: fit-to-width phone geometry, readable axis space, pointer/touch endpoints, clamps, zero width and long projections.",
);
