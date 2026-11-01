// A self-stirring mug: perspective view, exploded view, method and electronics.
// Units are millimetres. z is up; the default camera looks from azimuth 40°, elevation 28°.
export default ({ bezier, arc3 }) => {
  const az = (40 * Math.PI) / 180;
  const toViewer = [Math.cos(az), Math.sin(az), 0]; // horizontal direction toward the camera
  const screenRight = [Math.sin(az), -Math.cos(az), 0];
  const along = (d, r, z) => [d[0] * r, d[1] * r, z];

  // The handle leaves the mug wall on the right and comes back lower down.
  const handle = (lift) => bezier(along(screenRight, 38, lift + 78), along(screenRight, 78, lift + 84), along(screenRight, 80, lift + 30), along(screenRight, 38, lift + 32));
  const button = (z) => {
    const c = along(toViewer, 53, z), u = [screenRight[0] * 7, screenRight[1] * 7, 0];
    return [[c[0] - u[0], c[1] - u[1], c[2] - 5], [c[0] + u[0], c[1] + u[1], c[2] - 5], [c[0] + u[0], c[1] + u[1], c[2] + 5], [c[0] - u[0], c[1] - u[1], c[2] + 5]];
  };

  return {
    title: "Self-stirring beverage vessel with sugar dissolution detection",
    inventor: "Alex Rivera",
    date: "2026-11-01",
    field: "Kitchenware; small appliances; mornings",
    theme: "vintage",
    abstract:
      "A beverage vessel (10) rests on a powered base (20). A magnet (32) in the base turns an impeller (30) sealed in the floor of the vessel, " +
      "stirring the beverage without a spoon. A temperature sensor (24) and a controller estimate when added sugar has fully dissolved, " +
      "stop the impeller, and sound a short, triumphant chime. The handle (12) is positioned for either hand, and the base charges wirelessly.",
    numerals: { 24: "Temperature sensor" },
    figures: [
      {
        id: 1,
        view: { azimuth: 40, elevation: 24 },
        parts: [
          { type: "cylinder", at: [0, 0, 0], r: 52, h: 34, n: 20, name: "Powered base", rings: [44] },
          { type: "poly", points: button(17), n: 26, name: "Start button", hatch: 90, gap: 2.6 },
          { type: "cylinder", at: [0, 0, 34], r: 40, r2: 43, h: 96, hole: 37, n: 10, name: "Beverage vessel" },
          { type: "tube", points: handle(34), r: 6, n: 12, name: "Handle" },
          { type: "arrow", points: arc3([0, 0, 146], 24, [1, 0, 0], [0, 1, 0], 150, 330), n: 40, name: "Direction of stirring", whole: true, anchor: [0, 0, 146] },
        ],
      },
      {
        id: 2,
        view: { azimuth: 40, elevation: 18 },
        parts: [
          { type: "centerline", from: [0, 0, -10], to: [0, 0, 330] },
          { type: "cylinder", at: [0, 0, 0], r: 52, h: 34, n: 20, rings: [44] },
          { type: "cylinder", at: [0, 0, 22], r: 36, h: 6, n: 22, name: "Charging coil", shade: false, rings: [30, 24] },
          { type: "cylinder", at: [0, 0, 70], r: 18, h: 8, n: 32, name: "Drive magnet" },
          { type: "cylinder", at: [0, 0, 92], r: 4, h: 18, n: 34, name: "Spindle" },
          { type: "prism", plane: "xy", at: [0, 0, 112], depth: 5, shape: impeller(), n: 30, name: "Impeller" },
          { type: "cylinder", at: [0, 0, 160], r: 40, r2: 43, h: 96, hole: 37, n: 10 },
          { type: "tube", points: handle(160), r: 6, n: 12 },
          { type: "cylinder", at: [0, 0, 290], r: 45, h: 14, n: 14, name: "Splash lid", hole: 9 },
        ],
      },
      {
        id: 3,
        type: "flow",
        steps: [
          { kind: "start", text: "Start" },
          { n: 302, text: "Detect vessel placed on base" },
          { n: 304, text: "Measure beverage temperature and sugar added" },
          { n: 306, text: "Spin impeller at stirring speed" },
          { n: 308, kind: "decision", text: "Sugar dissolved?", no: 306 },
          { n: 310, text: "Stop impeller and play triumphant chime" },
          { kind: "end", text: "End" },
        ],
      },
      {
        id: 4,
        type: "blocks",
        blocks: [
          { id: "mcu", n: 402, text: "Controller", row: 0, col: 1 },
          { id: "temp", n: 24, text: "Temperature sensor", row: 0, col: 0 },
          { id: "drv", n: 404, text: "Motor driver", row: 1, col: 1 },
          { id: "mag", n: 32, text: "Drive magnet", row: 2, col: 1 },
          { id: "bat", n: 406, text: "Battery", row: 1, col: 0 },
          { id: "ble", n: 408, text: "Radio", row: 0, col: 2 },
          { id: "chime", n: 410, text: "Chime speaker", row: 1, col: 2 },
          { id: "app", n: 412, text: "Phone app", row: 3, col: 2, kind: "store" },
        ],
        groups: [{ id: "base", n: 20, text: "Powered base", contains: ["mcu", "temp", "drv", "mag", "bat", "ble", "chime"] }],
        links: [
          { from: "temp", to: "mcu" }, { from: "mcu", to: "drv" }, { from: "drv", to: "mag" },
          { from: "bat", to: "drv" }, { from: "mcu", to: "ble", both: true }, { from: "mcu", to: "chime" },
          { from: "ble", to: "app", both: true, dashed: true, text: "wireless" },
        ],
      },
    ],
  };

  function impeller() {
    // Four swept blades around a hub.
    const pts = [];
    for (let b = 0; b < 4; b++) {
      const a = (b * Math.PI) / 2;
      const p = (r, da) => [Math.cos(a + da) * r, Math.sin(a + da) * r];
      pts.push(p(6, -0.5), p(24, -0.25), p(30, 0.05), p(26, 0.25), p(6, 0.55));
    }
    return pts;
  }
};
