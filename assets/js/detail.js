const params = new URLSearchParams(window.location.search);
const id = params.get("id");

if (!id) {
  alert("論文IDが指定されていません");
  window.location.href = "index.html";
}

const paperInfo = document.getElementById("paperInfo");
const sectionList = document.getElementById("sectionList");
const paragraphSummaries = document.getElementById("paragraphSummaries");
const summaryText = document.getElementById("summaryText");
const summarizeSelectedBtn = document.getElementById("summarizeSelectedBtn");

const papers = JSON.parse(localStorage.getItem("papers") || "[]");
const paper = papers.find(p => p.id === id);

if (!paper) {
  alert("指定された論文が見つかりません");
  window.location.href = "index.html";
}

// APIエンドポイントの設定
const API_BASE_URL = "https://openai-proxy-server-w980.onrender.com";
const API_ENDPOINTS = {
  summarizeSection: `${API_BASE_URL}/summarize-section`,
  summarizeFull: `${API_BASE_URL}/summarize-full`
};

// 基本情報の表示
paperInfo.innerHTML = `
  <p><strong>タイトル:</strong> ${paper.title}</p>
  <p><strong>日付:</strong> ${paper.date}</p>
`;

// セクションリストの表示
function displaySectionList() {
  if (!paper.sections || paper.sections.length === 0) {
    sectionList.innerHTML = "<p>セクションが見つかりません</p>";
    summarizeSelectedBtn.disabled = true;
    return;
  }

  sectionList.innerHTML = paper.sections.map((section, index) => `
    <div class="section-item" data-index="${index}">
      <input type="checkbox" id="section${index}" name="section${index}">
      <label for="section${index}">${section.title}</label>
    </div>
  `).join('');

  // チェックボックスの状態変更時の処理
  const checkboxes = sectionList.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const sectionItem = checkbox.closest('.section-item');
      if (checkbox.checked) {
        sectionItem.classList.add('selected');
      } else {
        sectionItem.classList.remove('selected');
      }
      
      // 選択されているセクションがあるかどうかでボタンの有効/無効を切り替え
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      summarizeSelectedBtn.disabled = !anyChecked;
    });
  });
}

// 保存された要約の表示
if (paper.sectionSummaries) {
  paragraphSummaries.innerHTML = paper.sectionSummaries;
}
summaryText.value = paper.summary || "";

// 📝 選択されたセクションの要約
summarizeSelectedBtn.addEventListener("click", async () => {
  try {
    const selectedSections = Array.from(sectionList.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => {
        const index = parseInt(checkbox.closest('.section-item').dataset.index);
        return paper.sections[index];
      });

    if (selectedSections.length === 0) {
      alert("要約するセクションを選択してください。");
      return;
    }

    summarizeSelectedBtn.disabled = true;
    let allSummaries = "";
    paragraphSummaries.innerHTML = "<p>要約を開始します...</p>";

    for (const section of selectedSections) {
      try {
        paragraphSummaries.innerHTML = allSummaries + `<p>${section.title}を要約中...</p>`;

        const res = await fetch(API_ENDPOINTS.summarizeSection, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: section.content })
        });

        const data = await res.json();
        if (data.error) {
          throw new Error(`${data.error}\n${data.details || ''}`);
        }
        
        const summary = data.reply;
        allSummaries += `<div class="paragraph-summary">
          <h4>${section.title}の要約:</h4>
          <div class="summary-content">${summary}</div>
        </div>`;
        
        paragraphSummaries.innerHTML = allSummaries;
      } catch (e) {
        console.error(`${section.title}の処理中にエラー:`, e);
        allSummaries += `<p class="error-message">${section.title}の要約中にエラーが発生しました: ${e.message}</p>`;
        paragraphSummaries.innerHTML = allSummaries;
      }
    }

    paper.sectionSummaries = allSummaries;
    savePaperChanges();
  } catch (e) {
    console.error("要約エラー:", e);
    paragraphSummaries.innerHTML = `<p class="error-message">要約処理中にエラーが発生しました: ${e.message}</p>`;
  } finally {
    summarizeSelectedBtn.disabled = false;
  }
});

// 📚 全体要約
document.getElementById("summarizeAllBtn").addEventListener("click", async () => {
  const summarizeAllBtn = document.getElementById("summarizeAllBtn");
  try {
    if (!paper.sections || paper.sections.length === 0) {
      alert("セクション情報が見つかりません。PDFを再度アップロードしてください。");
      return;
    }

    summarizeAllBtn.disabled = true;
    summaryText.value = "要約を開始します...";

    // セクションの要約を結合して全体要約のベースとして使用
    const sectionSummaries = paper.sections.map(section => {
      const summary = section.summary || section.content;
      return `${section.title}\n${summary}`;
    }).join("\n\n");

    // テキストの長さを制限（約16K文字）
    const maxLength = 16000;
    const truncatedText = sectionSummaries.length > maxLength 
      ? sectionSummaries.slice(0, maxLength) + "..."
      : sectionSummaries;

    const res = await fetch(API_ENDPOINTS.summarizeFull, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ 
        content: truncatedText,
        title: paper.title
      })
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `APIエラー: ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`${data.error}\n${data.details || ''}`);
    }
    
    summaryText.value = data.reply;
    paper.summary = summaryText.value;
    paper.summarized = true;
    savePaperChanges();
  } catch (e) {
    console.error("全体要約エラー:", e);
    summaryText.value = `要約エラー: ${e.message}`;
    alert("要約処理中にエラーが発生しました。時間をおいて再度お試しください。");
  } finally {
    summarizeAllBtn.disabled = false;
  }
});

// 💾 変更を保存する共通関数
function savePaperChanges() {
  try {
    const papers = JSON.parse(localStorage.getItem("papers") || "[]");
    const updated = papers.map(p => (p.id === paper.id ? paper : p));
    localStorage.setItem("papers", JSON.stringify(updated));
  } catch (e) {
    console.error("保存エラー:", e);
    alert("変更の保存中にエラーが発生しました。");
  }
}

// 💾 保存して戻る
document.getElementById("saveBtn").addEventListener("click", () => {
  savePaperChanges();
  alert("保存しました！");
  window.location.href = "index.html";
});

// 初期表示
displaySectionList();
