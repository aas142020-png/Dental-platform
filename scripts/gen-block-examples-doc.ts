// Generates docs/block-examples.md from packages/content-schema/src/examples.ts.
// Run: npx tsx scripts/gen-block-examples-doc.ts
import { writeFileSync } from "node:fs";
import { BLOCK_TYPES, exampleCase, exampleQuestion, examples, parseBlock } from "../packages/content-schema/src";

let md = `# Block examples (generated)

Generated from \`packages/content-schema/src/examples.ts\`. Placeholder text only, no clinical content.
Every example passes \`parseBlock\` with zero issues and round-trips through Postgres in tests.
Envelope: \`{ ar?, en?, shared }\`. Media references live only in \`shared\`, always as \`{ "asset_id": "<uuid>" }\`.
`;
for (const t of BLOCK_TYPES) {
  const b = examples[t];
  const r = parseBlock(b);
  md += `\n## ${t}\n\nValid: ${r.ok ? "yes" : "NO"} · issues: ${r.issues.length} · claim links: ${JSON.stringify(b.claims ?? [])}\n\n\`\`\`json\n${JSON.stringify(b.content, null, 2)}\n\`\`\`\n`;
}
md += `\n## Question version (question_versions columns)\n\n\`\`\`json\n${JSON.stringify(exampleQuestion, null, 2)}\n\`\`\`\n`;
md += `\n## Case version (case_versions.content)\n\n\`\`\`json\n${JSON.stringify(exampleCase, null, 2)}\n\`\`\`\n`;
writeFileSync("docs/block-examples.md", md);
console.log("docs/block-examples.md written");
