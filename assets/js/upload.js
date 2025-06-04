const fileInput = document.getElementById("pdfInput");
const container = document.getElementById("pdfTextContainer");
const saveBtn = document.getElementById("saveBtn");

let extractedText = "";
let titleGuess = "";
let sections = [];
let fileDataUrl = null;

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // PDFファイルをData URLとして読み込む
  const dataUrlReader = new FileReader();
  dataUrlReader.onload = function() {
    fileDataUrl = dataUrlReader.result;
  };
  dataUrlReader.readAsDataURL(file);

  const reader = new FileReader();
  reader.onload = async function () {
    const pdfData = new Uint8Array(reader.result);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

    extractedText = "";
    sections = [];
    let currentSection = { title: "Introduction", content: "" };

    // すべてのページを処理
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = "";
      let lastY = null;
      let lineText = "";

      // 行ごとに処理
      for (const item of content.items) {
        if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
          // 新しい行の開始
          if (lineText.trim()) {
            pageText += lineText.trim() + "\n";
            
            // セクションの検出
            if (lineText.trim().match(/^([0-9]+\.)*[0-9]+\s+[A-Z]/)) {
              if (currentSection.content.trim()) {
                sections.push(currentSection);
              }
              currentSection = { title: lineText.trim(), content: "" };
            } else {
              currentSection.content += lineText.trim() + "\n";
            }
          }
          lineText = "";
        }
        lineText += item.str;
        lastY = item.transform[5];
      }
      
      if (lineText.trim()) {
        pageText += lineText.trim() + "\n";
        currentSection.content += lineText.trim() + "\n";
      }
      
      extractedText += pageText + "\n";
    }

    // 最後のセクションを追加
    if (currentSection.content.trim()) {
      sections.push(currentSection);
    }

    // タイトルの推定（最初の行を使用）
    titleGuess = extractedText.trim().split("\n")[0].slice(0, 100);

    // 抽出結果の表示
    container.innerHTML = `
      <h3>抽出結果:</h3>
      <p><strong>タイトル候補:</strong> ${titleGuess}</p>
      <div class="sections-preview">
        <h4>検出されたセクション:</h4>
        ${sections.map((section, i) => `
          <div class="section-item">
            <strong>${section.title}</strong>
            <p>${section.content.slice(0, 100)}...</p>
          </div>
        `).join('')}
      </div>
    `;

    saveBtn.style.display = "inline-block";
  };
  reader.readAsArrayBuffer(file);
});

saveBtn.addEventListener("click", () => {
  const entries = JSON.parse(localStorage.getItem("papers") || "[]");
  const newEntry = {
    id: Date.now().toString(),
    title: titleGuess || "Untitled",
    date: new Date().toISOString().split("T")[0],
    text: extractedText,
    sections: sections,
    summarized: false,
    sectionSummaries: '',
    summary: '',
    fileData: fileDataUrl  // PDFファイルのData URLを保存
  };
  entries.push(newEntry);
  localStorage.setItem("papers", JSON.stringify(entries));
  alert("論文を保存しました！");
  window.location.href = "index.html";
});
