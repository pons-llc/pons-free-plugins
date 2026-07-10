(() => {
    'use strict';
  
  
    kintone.events.on('app.record.detail.show', (event) => {
      let offsetX, offsetY;
      const formdata = JSON.parse(event.record.formjson.value);
      const ponsFields = Object.keys(formdata.properties);
      const printSpace = kintone.app.record.getSpaceElement("template");
  
      const wrapper = createElement('div', { id: 'wrapper', parent: printSpace });
      const upload = createElement('input', { id: 'upload', type: 'file', accept: 'application/pdf', parent: printSpace });
      const tabs = createElement('div', { id: 'tabs', parent: printSpace });
      const canvasWrapper = createElement('div', { id: 'canvas-wrapper', parent: wrapper });
      const canvasLayer = createElement('div', { id: 'canvas-layer', parent: canvasWrapper });
      const markerLayer = createElement('div', { id: 'marker-layer', parent: canvasWrapper });
      const tableWrapper = createElement('div', { parent: canvasWrapper, style: { width: '25%' } });
  
      const table = createCoordsTable();
      tableWrapper.appendChild(table);
  
      const downloadBtn = createElement('button', { text: 'PDFをダウンロード', parent: printSpace });
  
      let scale = 1;
      let currentPage = 1;
      let pdf = null;
  
      upload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
  
        const reader = new FileReader();
        reader.onload = async function () {
          const typedarray = new Uint8Array(this.result);
          pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
  
          tabs.innerHTML = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const tab = createElement('div', { class: 'tab', text: `Page ${i}`, parent: tabs });
            tab.addEventListener('click', () => loadPage(i));
          }
  
          loadPage(1);
  
          downloadBtn.addEventListener('click', async () => downloadPdf(file, table));
        };
        reader.readAsArrayBuffer(file);
      });
  
      function loadPage(pageNumber) {
        currentPage = pageNumber;
        pdf.getPage(pageNumber).then(async (page) => {
          const viewport = page.getViewport({ scale: 1.5 });
          scale = viewport.scale;
  
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
  
          canvasLayer.innerHTML = '';
          canvasLayer.appendChild(canvas);
  
          canvas.addEventListener('click', (e) => addMarker(e, canvas, table));
        });
      }
  
      function addMarker(e, canvas, table) {
        const rect = canvas.getBoundingClientRect();
        const x = Math.round((e.clientX - rect.left));
        const y = Math.round((e.clientY - rect.top));
        const scaledX = x * scale;
        const scaledY = y * scale;
  
        showModal((selectedField, selectedSize) => {
          const rowCount = table.querySelectorAll('tbody tr').length + 1;
          const row = addRowToTable(table, rowCount, currentPage, scaledX, scaledY, selectedField, selectedSize);
  
          const marker = createElement('div', {
            class: 'marker', text: selectedField, parent: markerLayer,
            style: {
              left: `${x}px`,
              top: `${y - selectedSize / 2 - 6}px`,
              fontSize: `${selectedSize}px`
            }
          });
  
          marker.dataset.rowIndex = rowCount;
          marker.addEventListener('dblclick', () => {
            row.remove();
            marker.remove();
          });
        });
      }
  
      function showModal(callback) {
        const modal = createElement('div', { class: 'modal', parent: document.body });
        const modalContent = createElement('div', { class: 'modal-content', parent: modal });
  
        const fieldSelect = createElement('select', { parent: modalContent });
        ponsFields.forEach(field => {
          createElement('option', { text: field, value: field, parent: fieldSelect });
        });
  
        const sizeInput = createElement('input', { type: 'number', value: 12, min: 1, max: 200, parent: modalContent });
  
        const okButton = createElement('button', { text: 'OK', parent: modalContent });
        const cancelButton = createElement('button', { text: 'キャンセル', parent: modalContent });
  
        okButton.addEventListener('click', () => {
          callback(fieldSelect.value, parseInt(sizeInput.value, 10));
          modal.remove();
        });
  
        cancelButton.addEventListener('click', () => modal.remove());
      }
  
      async function downloadPdf(file, table) {
        const { PDFDocument } = PDFLib;
        const existingPdfBytes = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
  
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
          const pageNumber = parseInt(row.cells[1].textContent) - 1;
          const xCoord = parseInt(row.cells[2].textContent.replace("x: ", ""));
          const yCoord = parseInt(row.cells[3].textContent.replace("y: ", ""));
          const text = row.cells[4].textContent.value;
          const fontSize = parseInt(row.cells[5].querySelector('input').value);
          const { height } = pages[pageNumber].getSize();
          const scaledY = height - yCoord;
  
          if (text) {
            pages[pageNumber].drawText(text, { x: xCoord, y: scaledY, size: fontSize });
          }
        });
  
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = createElement('a', { href: url, parent: document.body });
        a.download = 'annotated.pdf';
        a.click();
        URL.revokeObjectURL(url);
      }
  
      function createElement(tag, { id, class: className, text, type, value, min, max, accept, href, parent, style } = {}) {
        const el = document.createElement(tag);
        if (id) el.id = id;
        if (className) el.className = className;
        if (text) el.textContent = text;
        if (type) el.type = type;
        if (value !== undefined) el.value = value;
        if (min !== undefined) el.min = min;
        if (max !== undefined) el.max = max;
        if (accept) el.accept = accept;
        if (href) el.href = href;
        if (style) Object.assign(el.style, style);
        if (parent) parent.appendChild(el);
        return el;
      }
      
      function createCoordsTable() {
        const table = createElement('table', { id: 'coords-table' });
      
        const thead = createElement('thead', { parent: table });
        const headerRow = createElement('tr', { parent: thead });
      
        const headers = ['No.', 'ページ数', '座標X', '座標Y', 'テキスト', 'フォントサイズ', '削除'];
        headers.forEach(headerText => {
          createElement('th', { text: headerText, parent: headerRow });
        });
      
        createElement('tbody', { parent: table });
      
        return table;
      }
      
      function addRowToTable(table, rowCount, currentPage, scaledX, scaledY, selectedField, selectedSize) {
        const tbody = table.querySelector('tbody');
        const row = createElement('tr', { parent: tbody });
      
        const tdData = [
          rowCount,
          currentPage,
          `x: ${Math.floor(scaledX)}`,
          `y: ${Math.floor(scaledY)}`
        ];
      
        tdData.forEach(text => {
          createElement('td', { text: text, parent: row });
        });
      
        const textTd = createElement('td', { parent: row });
        createElement('input', { type: 'text', value: selectedField, parent: textTd });
      
        const sizeTd = createElement('td', { parent: row });
        createElement('input', { type: 'number', value: selectedSize, min: 1, max: 200, parent: sizeTd });
      
        const deleteTd = createElement('td', { parent: row });
        const deleteBtn = createElement('button', { text: '削除', class: 'delete-btn', parent: deleteTd });
      
        return row;
      }
      
    });
  })();
  