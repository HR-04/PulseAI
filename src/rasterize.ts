// SVG → PNG, so a flowchart can be visually inspected and embedded reliably.
import { Resvg } from "@resvg/resvg-js";
import { writeFile } from "node:fs/promises";

export async function svgToPng(svg: string, outPath: string, width = 1000): Promise<number> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    background: "white",
  });
  const png = resvg.render().asPng();
  await writeFile(outPath, png);
  return png.length;
}
