/* ============================================================
   JT Digi Dash — PDF EXPORT
   Renders the visible dashboard area to a multi-page A4 PDF.
   ============================================================ */
(function(){
  async function exportPDF(clientName, viewName){
    const node = document.getElementById("captureRoot");
    const { jsPDF } = window.jspdf;

    // html2canvas snapshot at 2x for crisp charts
    const canvas = await html2canvas(node, {
      backgroundColor:"#0a0e17", scale:2, useCORS:true, logging:false,
      windowWidth: node.scrollWidth, windowHeight: node.scrollHeight
    });

    const pdf = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const usableW = pageW - margin*2;

    // ---- header band ----
    pdf.setFillColor(15,21,37); pdf.rect(0,0,pageW,20,"F");
    pdf.setFillColor(31,182,255); pdf.rect(0,20,pageW,0.8,"F");
    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(14);
    pdf.text((window.JTDD_CONFIG.BRAND_NAME||"JT Digi Dash"), margin, 9);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(180,195,225);
    pdf.text(`${clientName}  ·  ${viewName}  ·  ${new Date().toLocaleString()}`, margin, 15);

    // ---- image, paginated ----
    const imgW = usableW;
    const imgH = canvas.height * imgW / canvas.width;
    const topOffset = 24;
    const availH = pageH - topOffset - margin;

    let remaining = imgH;
    let positionY = topOffset;
    let srcY = 0;
    const pxPerMm = canvas.width / imgW;

    if (imgH <= availH){
      pdf.addImage(canvas, "PNG", margin, topOffset, imgW, imgH);
    } else {
      // slice the tall canvas into page-height chunks
      while (remaining > 0){
        const sliceHmm = Math.min(availH, remaining);
        const sliceHpx = sliceHmm * pxPerMm;
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = sliceHpx;
        const sctx = slice.getContext("2d");
        sctx.fillStyle = "#0a0e17"; sctx.fillRect(0,0,slice.width,slice.height);
        sctx.drawImage(canvas, 0, srcY, canvas.width, sliceHpx, 0, 0, canvas.width, sliceHpx);
        pdf.addImage(slice, "PNG", margin, positionY, imgW, sliceHmm);
        remaining -= sliceHmm; srcY += sliceHpx;
        if (remaining > 0){ pdf.addPage(); positionY = margin; }
      }
    }

    const fname = `${clientName.replace(/[^a-z0-9]+/gi,"-")}_${viewName.replace(/[^a-z0-9]+/gi,"-")}_${new Date().toISOString().slice(0,10)}.pdf`;
    pdf.save(fname);
  }

  window.JTDD_PDF = { exportPDF };
})();
