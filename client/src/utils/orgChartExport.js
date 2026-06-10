import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const defaultFilenameBase = () => {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `SGC-Organogram-${stamp}`;
};

const captureDiagram = async (sourceEl) => {
  if (!sourceEl) throw new Error('Nothing to export');

  return html2canvas(sourceEl, {
    scale: 2,
    backgroundColor: '#ffffff',
    logging: false,
    useCORS: true,
    onclone: (_doc, clonedEl) => {
      clonedEl.style.transform = 'none';
      clonedEl.querySelectorAll('[data-connection-port]').forEach((el) => {
        el.style.display = 'none';
      });
      let parent = clonedEl.parentElement;
      while (parent && parent !== _doc.body) {
        parent.style.overflow = 'visible';
        parent.style.transform = 'none';
        parent = parent.parentElement;
      }
    }
  });
};

export const exportOrgChartToPng = async (sourceEl, filename) => {
  const canvas = await captureDiagram(sourceEl);
  const name = filename || `${defaultFilenameBase()}.png`;
  const link = document.createElement('a');
  link.download = name;
  link.href = canvas.toDataURL('image/png');
  link.click();
  return name;
};

export const exportOrgChartToPdf = async (sourceEl, options = {}) => {
  const {
    filename,
    title = 'Sardar Group of Companies',
    subtitle = 'Organizational Chart'
  } = options;

  const canvas = await captureDiagram(sourceEl);
  const imgData = canvas.toDataURL('image/png');

  const pxW = canvas.width;
  const pxH = canvas.height;
  const headerH = 72;
  const margin = 24;
  const maxPdfDim = 14000;

  let diagramW = pxW;
  let diagramH = pxH;
  const totalW = diagramW + margin * 2;
  const totalH = diagramH + headerH + margin * 2;

  let scale = 1;
  if (totalW > maxPdfDim || totalH > maxPdfDim) {
    scale = maxPdfDim / Math.max(totalW, totalH);
    diagramW = Math.floor(diagramW * scale);
    diagramH = Math.floor(diagramH * scale);
  }

  const pageW = diagramW + margin * 2;
  const pageH = diagramH + headerH + margin * 2;

  const pdf = new jsPDF({
    orientation: pageW >= pageH ? 'landscape' : 'portrait',
    unit: 'px',
    format: [pageW, pageH],
    hotfixes: ['px_scaling']
  });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(title, margin, margin + 18);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(80, 80, 80);
  pdf.text(subtitle, margin, margin + 38);

  const printed = new Date().toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  pdf.text(`Printed: ${printed}`, margin, margin + 54);

  pdf.setTextColor(0, 0, 0);
  pdf.addImage(imgData, 'PNG', margin, margin + headerH, diagramW, diagramH);

  const name = filename || `${defaultFilenameBase()}.pdf`;
  pdf.save(name);
  return name;
};
