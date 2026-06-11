/* ============================================================
   JT Digi Dash — PDF EXPORT
   Renders the visible dashboard area to a multi-page A4 PDF.
   ============================================================ */
(function(){
  // load an image as a dataURL (so jsPDF can embed it); returns null on failure
  function loadLogo(src){
    return new Promise(resolve=>{
      if(!src) return resolve(null);
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = ()=>{
        try{
          const c = document.createElement("canvas"); c.width=img.naturalWidth; c.height=img.naturalHeight;
          c.getContext("2d").drawImage(img,0,0);
          resolve({ data:c.toDataURL("image/png"), w:img.naturalWidth, h:img.naturalHeight });
        }catch(e){ resolve(null); }
      };
      img.onerror = ()=>resolve(null);
      img.src = src;
    });
  }

  async function exportPDF(clientName, viewName){
    const node = document.getElementById("captureRoot");
    const { jsPDF } = window.jspdf;
    const CFG = window.JTDD_CONFIG || {};
    const logo = await loadLogo(CFG.LOGO);

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

    let textX = margin;
    if (logo){
      // white tile so the logo (white bg) sits cleanly, keep aspect ratio
      const h = 14, w = Math.min(logo.w * h / logo.h, 42);
      pdf.setFillColor(255,255,255); pdf.roundedRect(margin, 3, w+2, h+1, 1.5, 1.5, "F");
      pdf.addImage(logo.data, "PNG", margin+1, 3.5, w, h);
      textX = margin + w + 6;
    }

    pdf.setTextColor(255,255,255); pdf.setFont("helvetica","bold"); pdf.setFontSize(13);
    pdf.text((CFG.AGENCY_NAME || CFG.BRAND_NAME || "JT Digi Dash"), textX, 9);
    pdf.setFont("helvetica","normal"); pdf.setFontSize(9); pdf.setTextColor(180,195,225);
    pdf.text(`${clientName}  ·  ${viewName}  ·  ${new Date().toLocaleString()}`, textX, 15);

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
