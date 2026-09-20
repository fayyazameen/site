const assert = require("node:assert/strict");
const { readFileSync, readdirSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");
const matter = require("gray-matter");

const compiled = ts.transpileModule(
  readFileSync(path.join(__dirname, "../src/lib/post-publication.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const moduleContext = { exports: {}, require };
vm.runInNewContext(compiled, moduleContext);
const { getPublicationDetails } = moduleContext.exports;

test("the author's optional time produces a local datetime without timezone conversion", () => {
  for (const time of ["4:07pm", "4:07 PM", "16:07"]) {
    const result = getPublicationDetails("09-19-2026", time);
    assert.equal(result.time, "4:07pm");
    assert.equal(result.dateTime, "2026-09-19T16:07:00");
    assert.equal(result.source, "original");
  }
  assert.equal(
    getPublicationDetails("09-19-2026", "12:00am").dateTime,
    "2026-09-19T00:00:00",
  );
  assert.equal(
    getPublicationDetails("09-19-2026", "12:00pm").dateTime,
    "2026-09-19T12:00:00",
  );
});

test("date-only posts remain date-only and imported posts retain their Medium source", () => {
  const result = getPublicationDetails("05-05-2020", undefined, "medium");
  assert.equal(result.dateTime, "2020-05-05");
  assert.equal(result.time, undefined);
  assert.equal(result.source, "medium");
});

test("publication datetimes sort chronologically, including same-day posts", () => {
  const times = ["4:07pm", "9:30am", "11:00pm"].map((time) =>
    getPublicationDetails("09-19-2026", time),
  );
  times.sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  assert.deepEqual(
    times.map((item) => item.time),
    ["11:00pm", "4:07pm", "9:30am"],
  );
});

test("invalid dates and times produce useful authoring errors", () => {
  assert.throws(() => getPublicationDetails("02-30-2026"), /MM-DD-YYYY/);
  for (const time of ["25:00", "24:00", "4:75pm", "later"]) {
    assert.throws(
      () => getPublicationDetails("09-19-2026", time),
      /Blog times/,
    );
  }
  assert.throws(
    () => getPublicationDetails("09-19-2026", 967),
    /Quote blog times/,
  );
});

test("Orange Cake is original writing with its authored time; all three older posts are Medium imports", () => {
  const directory = path.join(__dirname, "../src/content/blog");
  const posts = readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const { data } = matter(readFileSync(path.join(directory, file), "utf8"));
      return {
        id: file,
        ...getPublicationDetails(data.date, data.time, data.source),
      };
    })
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  const orangeCake = posts.find((post) => post.id === "orange-cake.md");
  assert.equal(orangeCake.time, "4:07pm");
  assert.equal(orangeCake.source, "original");
  for (const id of [
    "beauty-in-chaos.md",
    "last-of-us-nvm-its-a-ramble.md",
    "nothing-good-happens-after-2am.md",
  ]) {
    const imported = posts.find((post) => post.id === id);
    assert.equal(imported.source, "medium");
    assert.ok(orangeCake.dateTime > imported.dateTime);
  }
});
