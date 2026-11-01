// A software invention: the Code Wrapped skill, drawn the way a software patent would be.
// FIG. 1 is the device showing the story, FIG. 2 the system, FIG. 3 the method.
export default ({ roundRect }) => ({
  title: "System and method for rendering a version-control history as a narrative story",
  inventor: "Alex Rivera",
  date: "2026-11-01",
  field: "Developer tools; data storytelling",
  theme: "classic",
  abstract:
    "A collector (110) reads commit records from one or more repositories (102) and computes a set of statistics (112), " +
    "including activity rhythm, streaks and a personality archetype. A language model (120) writes captions grounded in those " +
    "statistics, and a builder (130) renders a sequence of story cards (210) for display on a handheld device (200). " +
    "An exporter (140) produces still images and a video suitable for sharing. Quoted commit text is screened before export.",
  figures: [
    {
      id: 1,
      view: { azimuth: 24, elevation: 14 },
      parts: [
        // A phone standing in a dock, its screen showing a story card.
        { type: "prism", plane: "yz", at: [0, 0, 0], depth: 70, shape: [[-34, 0], [34, 0], [26, 16], [-16, 16]], n: 220, name: "Dock" },
        {
          type: "box", at: [4, 6, 12], size: [8, 74, 150], n: 200, name: "Handheld device",
          panel: {
            face: "+x", inset: [5, 7], round: 6, glass: true,
            lines: [[[-0.8, 0.93], [0.8, 0.93]], [[-0.7, 0.72], [0.7, 0.72]], [[-0.7, 0.55], [0.3, 0.55]], [[-0.7, 0.42], [0.15, 0.42]], [[-0.7, -0.1], [-0.7, -0.6], [-0.35, -0.6], [-0.35, -0.3], [0, -0.3], [0, -0.6], [0.35, -0.6], [0.35, 0.05], [0.7, 0.05], [0.7, -0.6]]],
          },
        },
        { type: "box", at: [4, -31, 120], size: [9, 3, 18], n: 204, name: "Side button" },
      ],
      labels: [
        { n: 210, name: "Story card", at: [8.2, -10, 100] },
        { n: 212, name: "Progress indicator", at: [8.2, 20, 152] },
        { n: 214, name: "Activity chart", at: [8.2, 18, 50] },
      ],
    },
    {
      id: 2,
      type: "blocks",
      blocks: [
        { id: "repo", n: 102, text: "Repositories", row: 0, col: 0, kind: "store" },
        { id: "col", n: 110, text: "Collector", row: 0, col: 1 },
        { id: "stats", n: 112, text: "Statistics", row: 0, col: 2, kind: "store" },
        { id: "llm", n: 120, text: "Language model caption writer", row: 1, col: 2 },
        { id: "priv", n: 122, text: "Privacy screen", row: 1, col: 1 },
        { id: "build", n: 130, text: "Story builder", row: 2, col: 1 },
        { id: "exp", n: 140, text: "Exporter", row: 2, col: 2 },
        { id: "dev", n: 200, text: "Handheld device", row: 3, col: 0 },
        { id: "files", n: 150, text: "Images and video", row: 3, col: 2, kind: "store" },
      ],
      groups: [{ id: "sys", n: 100, text: "Story system", contains: ["col", "stats", "llm", "priv", "build", "exp"] }],
      links: [
        { from: "repo", to: "col" }, { from: "col", to: "stats" }, { from: "stats", to: "llm" },
        { from: "llm", to: "priv" }, { from: "priv", to: "build" }, { from: "build", to: "exp" },
        { from: "build", to: "dev" }, { from: "exp", to: "files" },
      ],
    },
    {
      id: 3,
      type: "flow",
      steps: [
        { kind: "start", text: "Start" },
        { n: 302, text: "Read commit records for an author and period" },
        { n: 304, text: "Compute rhythm, streak, languages and archetype" },
        { n: 306, text: "Generate captions from the statistics" },
        { n: 308, kind: "decision", text: "Every number found in the statistics?", no: 306 },
        { n: 310, kind: "decision", text: "Quoted text safe to share?", no: 312 },
        { n: 314, text: "Render story cards, images and video" },
        { kind: "end", text: "End" },
        { n: 312, text: "Remove card or ask the author", next: 314 },
      ],
    },
  ],
});
