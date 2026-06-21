// Quick connectivity check for the configured LLM provider.
// Run: npm run test:llm
import { getLLM } from "./llm";
import { config } from "./config";

const llm = getLLM();
console.log(`Provider: ${config.LLM_PROVIDER} (${llm.name})`);

const prompt = "In one sentence, what is retrieval-augmented generation?";
try {
  const out = await llm.complete(prompt, { system: "You are concise." });
  console.log("\n✅ Model responded:\n");
  console.log(out);
} catch (err) {
  console.error("\n❌ " + (err as Error).message);
  process.exit(1);
}
