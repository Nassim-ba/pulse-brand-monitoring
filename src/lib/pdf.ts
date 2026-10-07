"use client";

/**
 * Renders an element into a multi-page A4 PDF and downloads it. Page breaks are
 * moved to the start of elements marked with `data-pdf-block`, so sections and
 * table rows are not cut in half.
 */
export async function downloadElementAsPdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);

  const scale = 2;

  // Lay the element out at a fixed A4 width before measuring, so canvas size,
  // block positions and content all match regardless of the current screen.
  const previous = el.getAttribute("style") ?? "";
  el.classList.add("pdf-capture");
  Object.assign(el.style, { width: "794px", maxWidth: "794px", boxSizing: "border-box", padding: "28px 32px", borderRadius: "0", boxShadow: "none" });
  await new Promise((r) => setTimeout(r, 50)); // reading layout below forces a reflow anyway

  let canvas: HTMLCanvasElement;
  let blocks: { top: number; bottom: number }[];
  try {
    const origin = el.getBoundingClientRect().top;
    blocks = [...el.querySelectorAll<HTMLElement>("[data-pdf-block]")].map((b) => {
      const r = b.getBoundingClientRect();
      return { top: (r.top - origin) * scale, bottom: (r.bottom - origin) * scale };
    });
    canvas = await html2canvas(el, { scale, backgroundColor: "#ffffff", useCORS: true, logging: false });
  } finally {
    el.classList.remove("pdf-capture");
    el.setAttribute("style", previous);
  }

  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const margin = 10;
  const contentW = 210 - margin * 2;
  const contentH = 297 - margin * 2;
  const pxPerMm = canvas.width / contentW;
  const pagePx = Math.floor(contentH * pxPerMm);

  let y = 0;
  let page = 0;
  while (y < canvas.height - 2) {
    let end = Math.min(y + pagePx, canvas.height);
    if (end < canvas.height) {
      // Break before the innermost block that would be cut, unless that leaves the page mostly empty.
      const cut = blocks
        .filter((b) => b.top < end && b.bottom > end && b.top > y + pagePx * 0.35)
        .sort((a, b) => b.top - a.top)[0];
      if (cut) end = Math.floor(cut.top);
    }
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = end - y;
    slice.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentW, (end - y) / pxPerMm);
    y = end;
    page++;
  }

  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(`Seite ${i} von ${pages}`, 210 - margin, 297 - 4, { align: "right" });
  }
  pdf.save(filename);
}
